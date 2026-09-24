import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { db } from "@/lib/firebase-admin";
import { SUBMISSIONS_READ_LIMIT, WORKSHOP_SUBMISSIONS, toSubmission } from "@/lib/workshop-submissions";

// GET /api/events/workshop-submissions: every workshop gallery entry, hidden ones
// included, newest first, for the admin "Workshop submissions" tab.
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const snap = await db().collection(WORKSHOP_SUBMISSIONS).orderBy("createdAt", "desc").limit(SUBMISSIONS_READ_LIMIT).get();
  return NextResponse.json({ submissions: snap.docs.map((d) => toSubmission(d.id, d.data())) });
}
