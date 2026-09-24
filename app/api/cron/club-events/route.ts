import { NextResponse } from "next/server";
import { getEvent, getEvents, getRecs, isArmed, prepareEvent, previewConnect, sendConnectBlast, sendEventBlast, syncEvents, syncEventGuests, willSendAutomatically } from "@/lib/club";
import { CONNECT_WINDOW_MS, connectTiming, eventEndMs } from "@/lib/connect";
import { lumaConfigured } from "@/lib/luma";
import type { ClubEvent } from "@/lib/types";

export const maxDuration = 300;

// Hours before the event that each phase fires.
const PREPARE_AT = 48;
const SEND_AT = 24;
// Below this, a never-prepared event is a lost cause: preparing 4 hours out would
// email people who are already on their way.
const GIVE_UP_AT = 4;
// Look this far ahead before spending a single Luma call.
const HORIZON = 72;
// Earliest UTC hour the blast may go out, so nobody is woken at 3am. Default 13 = 9am ET.
const SEND_EARLIEST_UTC = Number(process.env.CLUB_SEND_EARLIEST_UTC ?? 13);
// Under this many hours out, send regardless of the hour: a late email still beats none.
const QUIET_HOURS_OVERRIDE_AT = 6;

const hoursOut = (e: ClubEvent, now: number) => (e.startAt - now) / 3_600_000;

// Events that ended recently enough to still be in (or just past) the connect
// window. Older events are ignored outright, so the 20+ historical events never
// get stamped as "missed".
const recentlyEnded = (events: ClubEvent[], now: number) =>
  events.filter((e) => {
    const end = eventEndMs(e);
    return end <= now && now - end < 2 * CONNECT_WINDOW_MS && !e.connect?.completedAt;
  });

/**
 * The AI Discussion Club cron. Runs hourly and does AT MOST ONE phase per tick:
 *
 *   48h out  PREPARE  compute every confirmed guest's five, email William a preview
 *   24h out  SEND     one paced batch of the blast, unless he flipped cancel
 *
 * Hourly rather than twice a day because that is what makes both phases resumable:
 * each carries a wall-clock deadline and reports what is left, so a timeout costs
 * one tick instead of the run. Inside the 23-hour send window that is ~23 retries.
 *
 * Cheap when idle: it reads the cached clubEvents mirror first and returns without
 * touching Luma unless something is inside the 72-hour horizon, so ~700 no-op ticks
 * a month cost one Firestore query each.
 *
 * The failure this design is written against: cron/weekly-matches calls
 * generateMatchesForPerson with no try/catch, so one throw on 2026-07-17 silently
 * killed the digest for every member after the 20th of 27. Here every per-recipient
 * body is isolated, progress is persisted per recipient, and a double tick cannot
 * double-send (the send phase claims each recipient in a transaction).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // Fail CLOSED: a missing CRON_SECRET must not make this world-callable. It runs
  // matchmaking and can email every confirmed guest of an event.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.JOBS_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "jobs-disabled" });
  }
  if (process.env.EMAIL_SENDING_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "email-sending-disabled" });
  }
  if (!lumaConfigured()) {
    return NextResponse.json({ ok: true, skipped: "luma-not-configured" });
  }

  const url = new URL(req.url);
  // Manual overrides for testing. Gated behind the cron secret, so not world-callable.
  const forcedEvent = url.searchParams.get("eventId");
  const forcedPhase = url.searchParams.get("phase"); // "prepare" | "send" | "connect"
  const force = url.searchParams.get("force") === "1";
  const limit = Number(url.searchParams.get("limit") ?? 0) || undefined;

  const started = Date.now();
  const deadline = started + 240_000;
  const now = started;

  try {
    if (forcedEvent && forcedPhase) {
      if (forcedPhase === "prepare") {
        await syncEventGuests(forcedEvent);
        const r = await prepareEvent({ eventId: forcedEvent, deadlineMs: deadline, sendPreview: true, force });
        return NextResponse.json({ ok: true, phase: "prepare", forced: true, ...r, ms: Date.now() - started });
      }
      if (forcedPhase === "send") {
        // A forced send is DRY BY DEFAULT and needs an explicit &live=1.
        // Learned the hard way: a manual `phase=send&force=1&limit=1` intended to
        // prove the cancel switch works instead delivered a real email to a real
        // guest, because the step that was supposed to set `cancelled` had failed
        // silently. An override that emails strangers should not be the default
        // behaviour of a debugging URL.
        if (url.searchParams.get("live") !== "1") {
          const event = await getEvent(forcedEvent);
          const recs = await getRecs(forcedEvent);
          const pending = recs.filter((r) => !r.emailedAt && !r.failedAt && r.people?.length);
          return NextResponse.json({
            ok: true,
            phase: "send",
            forced: true,
            dryRun: true,
            hint: "add &live=1 to actually send",
            eventId: forcedEvent,
            cancelled: !!event?.cancelled,
            autoSend: !!event?.autoSend,
            armed: event ? isArmed(event) : false,
            wouldSend: Math.min(pending.length, limit ?? Number(process.env.CLUB_SEND_BATCH ?? 25)),
            pending: pending.length,
            alreadyEmailed: recs.filter((r) => r.emailedAt).length,
            ms: Date.now() - started,
          });
        }
        const r = await sendEventBlast({ eventId: forcedEvent, limit, deadlineMs: deadline, ignoreCancelled: false });
        return NextResponse.json({ ok: true, phase: "send", forced: true, ...r, ms: Date.now() - started });
      }
      if (forcedPhase === "connect") {
        // Dry by default, like a forced send: it emails every guest who was going.
        if (url.searchParams.get("live") !== "1") {
          return NextResponse.json({
            ok: true,
            phase: "connect",
            forced: true,
            dryRun: true,
            hint: "add &live=1 to actually send",
            eventId: forcedEvent,
            ...(await previewConnect(forcedEvent)),
            ms: Date.now() - started,
          });
        }
        const r = await sendConnectBlast({ eventId: forcedEvent, limit, deadlineMs: deadline });
        return NextResponse.json({ ok: true, phase: "connect", forced: true, ...r, ms: Date.now() - started });
      }
      return NextResponse.json({ error: "phase must be prepare, send or connect" }, { status: 400 });
    }

    // Cheap idle path: Firestore only.
    let events = await getEvents();
    let upcoming = events
      .filter((e) => hoursOut(e, now) > 0 && hoursOut(e, now) <= HORIZON)
      .sort((a, b) => a.startAt - b.startAt);

    // Nothing near, but the mirror may be stale (a newly created event). Refresh the
    // event list once a day, off the hour the phases use.
    if (!upcoming.length) {
      if (new Date(now).getUTCHours() === 7) {
        await syncEvents();
        events = await getEvents();
        upcoming = events
          .filter((e) => hoursOut(e, now) > 0 && hoursOut(e, now) <= HORIZON)
          .sort((a, b) => a.startAt - b.startAt);
      }
      if (!upcoming.length && !recentlyEnded(events, now).length) {
        return NextResponse.json({ ok: true, skipped: "nothing-within-horizon", ms: Date.now() - started });
      }
    }

    for (const event of upcoming) {
      const h = hoursOut(event, now);
      const prepared = !!event.prepare?.completedAt;

      // PREPARE at T-48h, or late if a tick was missed (down to T-4h).
      if (h <= PREPARE_AT && !prepared) {
        if (h <= GIVE_UP_AT) {
          await db_stampGiveUp(event.id);
          continue;
        }
        // Pull the latest guest list first: prepare is only as good as who confirmed.
        await syncEventGuests(event.id);
        const r = await prepareEvent({ eventId: event.id, deadlineMs: deadline, sendPreview: true });
        return NextResponse.json({ ok: true, phase: "prepare", hoursOut: Number(h.toFixed(1)), ...r, ms: Date.now() - started });
      }

      // SEND from T-24h, in batches, unless cancelled or disarmed.
      if (h <= SEND_AT && prepared && !event.send?.completedAt) {
        if (event.cancelled) continue;
        if (!isArmed(event)) continue;
        const hourUtc = new Date(now).getUTCHours();
        if (hourUtc < SEND_EARLIEST_UTC && h > QUIET_HOURS_OVERRIDE_AT) {
          return NextResponse.json({
            ok: true,
            skipped: "quiet-hours",
            eventId: event.id,
            earliestUtcHour: SEND_EARLIEST_UTC,
            ms: Date.now() - started,
          });
        }
        const r = await sendEventBlast({ eventId: event.id, limit, deadlineMs: deadline });
        return NextResponse.json({ ok: true, phase: "send", hoursOut: Number(h.toFixed(1)), ...r, ms: Date.now() - started });
      }
    }

    // CONNECT at event end: "Connect with fellow participants" + the directory link.
    // Runs only when no pre-event phase needed this tick (one phase per tick).
    for (const event of recentlyEnded(events, now)) {
      if (!willSendAutomatically(event)) continue;
      if (!(event.counts?.approved > 0)) continue;
      if (connectTiming(event, now) === "missed") {
        await db_stampConnectMissed(event.id);
        continue;
      }
      const r = await sendConnectBlast({ eventId: event.id, limit, deadlineMs: deadline });
      return NextResponse.json({ ok: true, phase: "connect", ...r, ms: Date.now() - started });
    }

    return NextResponse.json({
      ok: true,
      skipped: "nothing-due",
      considered: upcoming.map((e) => ({ id: e.id, hoursOut: Number(hoursOut(e, now).toFixed(1)) })),
      ms: Date.now() - started,
    });
  } catch (e) {
    // Surface the error rather than 200-ing a failure: an event that silently never
    // prepares is exactly the outage this feature is designed to avoid.
    console.error("[club cron]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// Record that an event blew past its window unprepared, so /events shows why the
// blast never went out instead of just showing nothing.
async function db_stampGiveUp(eventId: string) {
  const { db } = await import("@/lib/firebase-admin");
  await db()
    .collection("clubEvents")
    .doc(eventId)
    .set(
      { prepare: { startedAt: Date.now(), error: "Missed the prepare window (less than 4 hours out)." } },
      { merge: true },
    );
}

// The connect email's window (24h after the end) passed without a successful run.
async function db_stampConnectMissed(eventId: string) {
  const { db } = await import("@/lib/firebase-admin");
  await db()
    .collection("clubEvents")
    .doc(eventId)
    .set(
      { connect: { startedAt: Date.now(), sent: 0, skipped: 0, failed: 0, completedAt: Date.now(), error: "Missed the connect window (more than 24 hours after the event ended)." } },
      { merge: true },
    );
}
