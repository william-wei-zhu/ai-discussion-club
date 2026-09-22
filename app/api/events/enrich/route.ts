import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { enrichContacts } from "@/lib/club";

export const maxDuration = 300;

// POST /api/events/enrich — run a bounded enrichment batch on demand (the same
// lib function the nightly cron uses). Body: { eventId?, limit?, skipExa? }.
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club_enrich", 20)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { eventId?: string; limit?: number; skipExa?: boolean };
  const started = Date.now();
  try {
    const s = await enrichContacts({
      eventId: body.eventId,
      limit: Number(body.limit ?? 25),
      skipExa: !!body.skipExa,
      deadlineMs: started + 240_000,
    });
    return NextResponse.json({ ok: true, ...s, ms: Date.now() - started });
  } catch (e) {
    console.error("[club enrich route]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
