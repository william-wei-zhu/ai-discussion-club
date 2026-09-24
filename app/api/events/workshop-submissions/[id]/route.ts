import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { db } from "@/lib/firebase-admin";
import { WORKSHOP_SUBMISSIONS } from "@/lib/workshop-submissions";

// PATCH /api/events/workshop-submissions/[id]  { hidden: boolean }
// Hides or restores a gallery entry. The submitter's name and link are never edited.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null) as { hidden?: unknown } | null;
  if (typeof body?.hidden !== "boolean") return NextResponse.json({ error: "Send hidden: true or false." }, { status: 400 });
  const ref = db().collection(WORKSHOP_SUBMISSIONS).doc(id);
  if (!(await ref.get()).exists) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  await ref.update({ hidden: body.hidden });
  return NextResponse.json({ ok: true, hidden: body.hidden });
}
