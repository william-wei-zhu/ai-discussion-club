import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { db } from "@/lib/firebase-admin";
import { ADMIN_NOTE_MAX, DEMO_APPLICATIONS, isDemoStatus } from "@/lib/demo-applications";

// PATCH /api/events/demo-applications/[id]  { status?, adminNote? }
// Review fields only; the applicant's own answers are never editable here.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: unknown; adminNote?: unknown } | null;
  const patch: { status?: string; adminNote?: string; updatedAt: number } = { updatedAt: Date.now() };
  if (body?.status !== undefined) {
    if (!isDemoStatus(body.status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    patch.status = body.status;
  }
  if (body?.adminNote !== undefined) {
    if (typeof body.adminNote !== "string" || body.adminNote.length > ADMIN_NOTE_MAX) {
      return NextResponse.json({ error: `Keep the note under ${ADMIN_NOTE_MAX} characters.` }, { status: 400 });
    }
    patch.adminNote = body.adminNote;
  }
  if (patch.status === undefined && patch.adminNote === undefined) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const ref = db().collection(DEMO_APPLICATIONS).doc(id);
  if (!(await ref.get()).exists) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  await ref.update(patch);
  return NextResponse.json({ ok: true, ...patch });
}
