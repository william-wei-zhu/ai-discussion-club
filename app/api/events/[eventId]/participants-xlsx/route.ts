import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { getEvent, getEventGuests, buildParticipantRows, CONTACTS } from "@/lib/club";
import { db } from "@/lib/firebase-admin";
import type { ClubContact } from "@/lib/types";

// GET /api/events/[eventId]/participants-xlsx — a downloadable .xlsx of everyone in
// the room (approved guests + hosts) with three columns: Name, Background, LinkedIn
// URL. Built for the admin to send the roster to attendees themselves (via Luma),
// not emailed by us. On-demand: before the event it is the signup list, after it is
// the final roster.
//
// The workbook is returned base64-encoded inside JSON because the admin console's
// shared fetch helper (`useAuthFetch`) always parses the response as JSON and cannot
// stream a binary body; the client decodes it to a Blob and triggers the download.

/** A filesystem-safe slug of the event name, for the download filename. */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { eventId } = await params;

  const [event, guests] = await Promise.all([getEvent(eventId), getEventGuests(eventId)]);
  if (!event) return NextResponse.json({ error: "Unknown event." }, { status: 404 });

  // One fan-out read of only the four contact fields the sheet needs. Never the
  // signal subcollection, so no embeddings can reach the client (same rule as the
  // guests route).
  const ids = guests.map((g) => g.id);
  const contacts = new Map<
    string,
    Pick<ClubContact, "name" | "headline" | "linkedinUrl" | "linkedinConfidence">
  >();
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map((id) => db().collection(CONTACTS).doc(id));
    if (!refs.length) continue;
    const snaps = await db().getAll(...refs, {
      fieldMask: ["name", "headline", "linkedinUrl", "linkedinConfidence"],
    });
    for (const s of snaps) if (s.exists) contacts.set(s.id, s.data() as ClubContact);
  }

  const rows = buildParticipantRows(guests, contacts);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Participants");
  sheet.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Background", key: "background", width: 80 },
    { header: "LinkedIn URL", key: "linkedin", width: 45 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn("background").alignment = { wrapText: true, vertical: "top" };
  for (const r of rows) sheet.addRow(r);

  const buffer = await workbook.xlsx.writeBuffer();
  const xlsx = Buffer.from(buffer).toString("base64");
  const date = event.startAt ? new Date(event.startAt).toISOString().slice(0, 10) : "";
  const filename = [slugify(event.name || eventId), date, "participants"].filter(Boolean).join("-") + ".xlsx";

  return NextResponse.json({ xlsx, filename, count: rows.length });
}
