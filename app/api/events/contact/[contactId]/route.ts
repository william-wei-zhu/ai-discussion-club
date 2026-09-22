import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { verifyRequest } from "@/lib/firebase-admin";
import { setEmailOptOut, clearBounce } from "@/lib/club";

// POST /api/events/contact/[contactId] — per-contact list actions.
//   { action: "resubscribe" }   put someone back on the club list
//   { action: "optout" }        take someone off by hand (same as their own link)
//   { action: "clear-bounce" }  retry an address a send previously failed on
//
// Action allowlist rather than free-form fields, matching the /api/admin/moderate/*
// idiom: an unknown action is a 400, never a partial write.
//
// "resubscribe" exists because the unsubscribe route is deliberately one-way, which
// left no path back short of editing Firestore when someone mis-clicked a one-click
// header button. It records who did it and when. Only use it when the person asked.
const ACTIONS = ["resubscribe", "optout", "clear-bounce"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { contactId } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = String(body.action ?? "");
  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}.` }, { status: 400 });
  }
  const auth = await verifyRequest(req);
  const by = auth?.email ?? "admin";

  try {
    if (action === "resubscribe") await setEmailOptOut(contactId, false, by);
    if (action === "optout") await setEmailOptOut(contactId, true, by);
    if (action === "clear-bounce") await clearBounce(contactId, by);
    return NextResponse.json({ ok: true, action, contactId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
