import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { verifyRequest } from "@/lib/firebase-admin";
import { setCancelled, setAutoSend, getEvent } from "@/lib/club";

// POST /api/events/[eventId]/cancel — the kill switch and the arming switch.
//   { cancelled: true }  stop the blast (reversible any time before it sends)
//   { autoSend: true }   arm the T-24h auto-send for this event
//
// Cancelling blocks ONLY the send. Prepare and the admin preview keep running, so
// the recommendations can still be inspected for a cancelled event.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { eventId } = await params;
  const body = (await req.json().catch(() => ({}))) as { cancelled?: unknown; autoSend?: unknown };
  if (typeof body.cancelled !== "boolean" && typeof body.autoSend !== "boolean") {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }
  // Both setters merge-write, so an unknown id would otherwise create a phantom event.
  if (!(await getEvent(eventId))) return NextResponse.json({ error: "Unknown event." }, { status: 404 });
  const auth = await verifyRequest(req);

  if (typeof body.cancelled === "boolean") {
    await setCancelled(eventId, body.cancelled, auth?.email ?? "admin");
  }
  if (typeof body.autoSend === "boolean") {
    await setAutoSend(eventId, body.autoSend, auth?.email ?? "admin");
  }
  return NextResponse.json({ ok: true, event: await getEvent(eventId) });
}
