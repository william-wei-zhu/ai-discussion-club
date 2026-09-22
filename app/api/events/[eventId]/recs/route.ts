import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { getRec, getRecs } from "@/lib/club";

// GET /api/events/[eventId]/recs?guest=<user_api_id> — one guest's computed five
// (the preview panel), or a light index of every recipient. Read-only, no compute.
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { eventId } = await params;
  const guest = new URL(req.url).searchParams.get("guest");
  if (guest) return NextResponse.json({ rec: await getRec(eventId, guest) });

  const recs = await getRecs(eventId);
  return NextResponse.json({
    count: recs.length,
    emailed: recs.filter((r) => r.emailedAt).length,
    failed: recs.filter((r) => r.failedAt).length,
    reasoned: recs.filter((r) => r.lineSource === "gemini").length,
    recipients: recs.map((r) => ({
      recipientId: r.recipientId,
      recipientName: r.recipientName,
      people: r.people?.length ?? 0,
      lineSource: r.lineSource,
      emailedAt: r.emailedAt ?? null,
      failedAt: r.failedAt ?? null,
    })),
  });
}
