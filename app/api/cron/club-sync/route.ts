import { NextResponse } from "next/server";
import { syncContacts, syncEvents } from "@/lib/club";
import { calendarSyncGate } from "@/lib/cron-sync";
import { lumaConfigured } from "@/lib/luma";

export const maxDuration = 300;

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
    return NextResponse.json({ ok: true, events, contacts, ms: Date.now() - started });
  } catch (error) {
    console.error("[club sync cron]", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
