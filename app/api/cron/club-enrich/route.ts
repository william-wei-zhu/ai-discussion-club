import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/cron-sync";
import { enrichContacts, getEventGuests, getEvents } from "@/lib/club";
import { lumaConfigured } from "@/lib/luma";
import { classifyPending } from "@/lib/audience";

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
  const limitRaw = Number(url.searchParams.get("limit") ?? 120);
  const started = Date.now();

  // Prioritise upcoming events' confirmed guests, soonest event first: they are
  // whose data is about to matter (matching, and each event's public audience page).
  // With no upcoming guests, enrichContacts falls back to the most-engaged contacts,
  // which is the useful default for a quiet week.
  const upcoming = (await getEvents()).filter((e) => e.startAt > started).sort((a, b) => a.startAt - b.startAt);
  const ids = new Set<string>();
  for (const e of upcoming) {
    for (const g of await getEventGuests(e.id)) {
      // Hosts included: organizers are attending, and Luma reports them as "invited".
      if (g.approvalStatus === "approved" || g.isHost) ids.add(g.id);
    }
  }
  const guestIds = [...ids];

  try {
    const s = await enrichContacts({
      contactIds: guestIds.length ? guestIds : undefined,
      limit: Number.isFinite(limitRaw) ? limitRaw : 120,
      deadlineMs: started + 240_000,
    });
    // Then label past attendees who have no audience labels yet, in the time left.
    const audience = await classifyPending({ limit: 300, deadlineMs: started + 280_000 })
      .catch((e) => ({ error: (e as Error).message }));
    return NextResponse.json({ ok: true, upcomingEvents: upcoming.length, upcomingGuests: guestIds.length, ...s, audience, ms: Date.now() - started });
  } catch (e) {
    console.error("[club enrich cron]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
