import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { sendConnectTest } from "@/lib/club";

// POST /api/events/[eventId]/connect-test — send the "Connect with fellow
// participants" email to the admin address only, marked [test]. Creates the
// event's fixed directory link if it has none (or replaces a legacy one once).
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club_test_send", 30)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { eventId } = await params;
  try {
    return NextResponse.json({ ok: true, ...(await sendConnectTest(eventId)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
