import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { prepareEvent, syncEventGuests } from "@/lib/club";

export const maxDuration = 300;

// POST /api/events/[eventId]/prepare — compute every confirmed guest's five now,
// rather than waiting for the T-48h cron tick. Body: { force?, preview? }.
//
// `force` recomputes recipients who already have recs. It never touches anyone
// already EMAILED: their email has to match what they actually received.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club_prepare", 20)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { eventId } = await params;
  const body = (await req.json().catch(() => ({}))) as { force?: boolean; preview?: boolean };
  const started = Date.now();
  try {
    await syncEventGuests(eventId);
    const r = await prepareEvent({
      eventId,
      deadlineMs: started + 240_000,
      sendPreview: body.preview !== false,
      force: !!body.force,
    });
    return NextResponse.json({ ok: true, ...r, ms: Date.now() - started });
  } catch (e) {
    console.error("[club prepare route]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
