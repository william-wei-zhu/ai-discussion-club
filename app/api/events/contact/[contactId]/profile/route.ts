import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { verifyRequest } from "@/lib/firebase-admin";
import { setManualProfile, getManualProfile, enrichContacts } from "@/lib/club";

export const maxDuration = 300;

// GET  /api/events/contact/[contactId]/profile   read the pasted profile
// POST /api/events/contact/[contactId]/profile   { text, rebuild? }
//
// The escape hatch for the ~10% of contacts whose LinkedIn we trust but cannot
// read (Exa returns no content for the URL). Pasting the profile in gives the
// matcher prose to work with, which is the difference between a reasoned "you two
// should talk because..." line and a serendipity pick.
//
// POST rebuilds their signal immediately by default, so the effect is visible on
// the next Prepare rather than waiting for the nightly enrich cron.
export async function POST(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { contactId } = await params;
  const body = (await req.json().catch(() => ({}))) as { text?: string; rebuild?: boolean };
  if (typeof body.text !== "string") {
    return NextResponse.json({ error: "text is required (send an empty string to clear)." }, { status: 400 });
  }
  const auth = await verifyRequest(req);
  await setManualProfile(contactId, body.text, auth?.email ?? "admin");

  // Re-extract just this person. skipExa because we already have better text than
  // Exa could give us, and there is no reason to pay for a lookup we will ignore.
  let rebuilt: unknown = null;
  if (body.rebuild !== false) {
    rebuilt = await enrichContacts({ contactIds: [contactId], limit: 1, skipExa: true });
  }
  return NextResponse.json({ ok: true, rebuilt });
}

export async function GET(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { contactId } = await params;
  return NextResponse.json({ text: (await getManualProfile(contactId)) ?? "" });
}
