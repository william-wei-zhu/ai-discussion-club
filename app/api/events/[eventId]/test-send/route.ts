import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { sendTestCopy } from "@/lib/club";

// POST /api/events/[eventId]/test-send — send ONE guest's real email to the admin
// address instead of to them. Body: { guestId }.
//
// The subject is prefixed [test] and the body names the real recipient, so a test
// can never be mistaken for the live blast.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club_test_send", 30)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { eventId } = await params;
  const body = (await req.json().catch(() => ({}))) as { guestId?: string; to?: string };
  if (!body.guestId) return NextResponse.json({ error: "guestId is required." }, { status: 400 });
  // An optional explicit address (to show a specific person their own email).
  // Validated rather than passed through: this route is admin-gated, but a route
  // that emails an arbitrary address deserves a shape check regardless.
  const to = body.to?.trim();
  if (to && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
  }
  if (to && to.toLowerCase() !== "wzhu1997@gmail.com") {
    return NextResponse.json({ error: "Test email can only be sent to the owner." }, { status: 400 });
  }
  try {
    const out = await sendTestCopy(eventId, String(body.guestId), to);
    // Echo the event + recipient so the UI (and any log) shows WHICH event's email
    // went out, not just that one did.
    return NextResponse.json({
      ok: true,
      id: (out.res as { data?: { id?: string } })?.data?.id ?? null,
      eventName: out.eventName,
      recipientName: out.recipientName,
      sentTo: out.sentTo,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
