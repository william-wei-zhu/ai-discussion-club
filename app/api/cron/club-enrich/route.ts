import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/cron-sync";
import { enrichContacts, getEvents } from "@/lib/club";
import { lumaConfigured } from "@/lib/luma";

export const maxDuration = 300;

// GET /api/cron/club-enrich — the nightly LinkedIn + signal backfill.
//
// Its own job for one reason: Exa must NEVER be on the T-24h critical path. A slow
// or rate-limited enrichment run must not delay anyone's email, so the blast only
// ever reads what this job already cached. Bounded by a wall-clock deadline and the
// daily spend caps, and idempotent (the per-contact Exa cache plus sourceHash), so a
// nightly re-run over the same people costs nothing.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // Fail closed: a missing CRON_SECRET must not make a paid-enrichment job public.
  if (!bearerMatches(auth, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.JOBS_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "jobs-disabled" });
  }
  if (!lumaConfigured()) return NextResponse.json({ ok: true, skipped: "luma-not-configured" });

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 60);
  const started = Date.now();

  // Prioritise the next event's confirmed guests: they are whose data is about to
  // matter. With no upcoming event, enrichContacts falls back to the most-engaged
  // contacts, which is the useful default for a quiet week.
  const next = (await getEvents()).filter((e) => e.startAt > started).sort((a, b) => a.startAt - b.startAt)[0];

  try {
    const s = await enrichContacts({
      eventId: next?.id,
      limit: Number.isFinite(limitRaw) ? limitRaw : 60,
      deadlineMs: started + 240_000,
    });
    return NextResponse.json({ ok: true, eventId: next?.id ?? null, ...s, ms: Date.now() - started });
  } catch (e) {
    console.error("[club enrich cron]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
