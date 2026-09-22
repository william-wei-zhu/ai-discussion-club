import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { syncContacts, syncEvents, syncEventGuests } from "@/lib/club";
import { lumaConfigured } from "@/lib/luma";

// Pulling 1,072 guests is 22 throttled Luma pages (~15s), and the roster is
// another 22. Well inside the platform default, but not a 10s route.
export const maxDuration = 300;

// POST /api/events/sync — pull from Luma on demand.
//   {}                        -> events + the calendar roster
//   { eventId: "evt-..." }    -> that event's guest list only
//
// This is the ONLY admin-triggered path that talks to Luma. Every read route
// serves Firestore, so a busy page cannot fan out into Luma's rate limiter.
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club_sync", 20)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  if (!lumaConfigured()) {
    return NextResponse.json({ error: "LUMA_API_KEY is not set." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { eventId?: string };
  const started = Date.now();
  try {
    if (body.eventId) {
      const s = await syncEventGuests(String(body.eventId));
      return NextResponse.json({ ok: true, scope: "guests", ...s, ms: Date.now() - started });
    }
    const events = await syncEvents();
    const contacts = await syncContacts();
    return NextResponse.json({ ok: true, scope: "calendar", events, contacts, ms: Date.now() - started });
  } catch (e) {
    // Surface Luma's status verbatim ("Luma /path -> 403"), which is how a bad key
    // or a rejected User-Agent identifies itself.
    console.error("[club sync]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
