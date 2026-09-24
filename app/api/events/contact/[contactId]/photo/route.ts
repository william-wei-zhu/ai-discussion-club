import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { db } from "@/lib/firebase-admin";
import { CONTACTS } from "@/lib/club";
import { clearPhoto, ProfileInputError, setPhoto } from "@/lib/profile";
import { MAX_PHOTO_BYTES, profileView } from "@/lib/profile-rules";
import type { ClubContact } from "@/lib/types";

// POST/DELETE /api/events/contact/[contactId]/photo — admin sets or removes a
// contact's photo (multipart field "photo"). Same pipeline as /preferences.
async function gate(req: Request, contactId: string) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club_photo", 60)) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  if (!(await db().collection(CONTACTS).doc(contactId).get()).exists) return NextResponse.json({ error: "Unknown contact." }, { status: 404 });
  return null;
}

async function view(contactId: string) {
  return profileView((await db().collection(CONTACTS).doc(contactId).get()).data() as ClubContact | undefined);
}

export async function POST(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  if (Number(req.headers.get("content-length") || 0) > MAX_PHOTO_BYTES + 64 * 1024) return NextResponse.json({ error: "That photo is too large (4 MB max)." }, { status: 413 });
  const blocked = await gate(req, contactId);
  if (blocked) return blocked;
  const file = (await req.formData().catch(() => null))?.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  try {
    await setPhoto(contactId, Buffer.from(await file.arrayBuffer()), "admin");
  } catch (e) {
    if (e instanceof ProfileInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[admin photo]", e);
    return NextResponse.json({ error: "The photo could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile: await view(contactId) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const blocked = await gate(req, contactId);
  if (blocked) return blocked;
  await clearPhoto(contactId);
  return NextResponse.json({ ok: true, profile: await view(contactId) });
}
