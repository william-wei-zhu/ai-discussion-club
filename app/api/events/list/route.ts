import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { countPendingLookup, getEvents } from "@/lib/club";
import { lumaConfigured } from "@/lib/luma";
import { db } from "@/lib/firebase-admin";
import { DIRECTORY_ACCESS, directoryStatus } from "@/lib/directory";

// GET /api/events/list — the clubEvents mirror, newest first, with each event's
// counts and job state. Firestore only; Luma is never called from a read path.
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const events = await getEvents();
  const now = Date.now();

  // How many attendees still need a profile lookup, computed ONLY for upcoming
  // events. The button used to advertise a hardcoded batch size ("Look up 25") on
  // every event regardless of how many actually needed it, which read as a count and
  // was not one.
  const pending = new Map<string, number>();
  await Promise.all(
    events
      .filter((e) => e.startAt > now)
      .map(async (e) => pending.set(e.id, await countPendingLookup(e.id).catch(() => 0))),
  );

  // Directory link status for every event in ONE read, so the cards do not each
  // fetch their own (that fan-out used to trip the rate limit and log the admin out).
  const dirSnaps = events.length ? await db().getAll(...events.map((e) => db().collection(DIRECTORY_ACCESS).doc(e.id))) : [];
  const directory = new Map(dirSnaps.map((snap) => [snap.id, directoryStatus(snap.data())]));

  return NextResponse.json({
    setup: {
      firebase: true,
      luma: lumaConfigured(),
      gemini:
        (process.env.GOOGLE_VERTEX_PROJECT ?? "ai-discussion-club-260922") === "ai-discussion-club-260922" &&
        Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || process.env.GOOGLE_APPLICATION_CREDENTIALS),
      exa: Boolean(process.env.EXA_API_KEY),
      resend: Boolean(process.env.RESEND_API_KEY || process.env.CLUB_RESEND_API_KEY),
      jobsEnabled: process.env.JOBS_ENABLED === "true",
      emailSendingEnabled: process.env.EMAIL_SENDING_ENABLED === "true",
    },
    events: events.map((e) => ({
      ...e,
      hoursUntil: (e.startAt - now) / 3_600_000,
      ...(pending.has(e.id) ? { pendingLookup: pending.get(e.id) } : {}),
      directory: directory.get(e.id) ?? { enabled: false },
    })),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
