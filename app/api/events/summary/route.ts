import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { getSummary } from "@/lib/club";

// GET /api/events/summary — stat tiles for the private /events console, plus the
// next event's job state (prepared / preview sent / blast progress / cancelled).
//
// This route is also what the client gate posts against to validate the admin
// password, mirroring how /admin validates against /api/admin/metrics.
//
// Rate-limit key is "club", NOT the shared "admin" bucket: one /events load fires
// several fetches and the page has refresh buttons, so sharing the bucket could
// lock the admin out of /admin. Same spoof-resistant clientIp source.
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  return NextResponse.json(await getSummary());
}
