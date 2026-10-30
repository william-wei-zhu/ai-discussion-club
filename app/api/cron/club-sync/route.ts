import { NextResponse } from "next/server";
import { getEvents, syncContacts, syncEventGuests, syncEvents } from "@/lib/club";
import { calendarSyncGate } from "@/lib/cron-sync";
import { lumaConfigured } from "@/lib/luma";
import { rebuildClubAudience } from "@/lib/audience";

export const maxDuration = 300;
const UPCOMING_GUEST_SYNC_MS = 60 * 86_400_000;

// Refresh the independent Firestore mirror every hour, regardless of whether an
// event is close enough for matching. Public event reads never call Luma directly.
export async function GET(req: Request) {
  const gate = calendarSyncGate({
    authorization: req.headers.get("authorization"),
    secret: process.env.CRON_SECRET,
    jobsEnabled: process.env.JOBS_ENABLED === "true",
    lumaConfigured: lumaConfigured(),
  });

  if (gate === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (gate !== "ready") {
    return NextResponse.json({ ok: true, skipped: gate });
  }

  const started = Date.now();
  try {
    const events = await syncEvents();
    const contacts = await syncContacts();
    // Guest lists of upcoming events (otherwise first pulled at T-48h for matching),
    // so each event's public audience page fills in as people register. One failed
    // event must not fail the sync.
    const soon = (await getEvents()).filter((e) => e.startAt > started && e.startAt < started + UPCOMING_GUEST_SYNC_MS);
    const guests: Record<string, number | string> = {};
    for (const e of soon) {
      guests[e.id] = await syncEventGuests(e.id).then((r) => r.guests ?? 0).catch((err) => (err as Error).message);
    }
    // The public /audience summary. A failure here must not fail the sync.
    const audience = await rebuildClubAudience()
      .then((a) => ({ people: a.people, classified: a.classified }))
      .catch((e) => { console.error("[club sync audience]", e); return { error: (e as Error).message }; });
    return NextResponse.json({ ok: true, events, contacts, guests, audience, ms: Date.now() - started });
  } catch (error) {
    console.error("[club sync cron]", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
