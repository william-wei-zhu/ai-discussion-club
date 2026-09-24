import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { chargeProfileChange, PREFERENCE_COOKIE, preferenceSession, requestOriginAllowed } from "@/lib/preferences";
import { clearPhoto, ProfileInputError, setPhoto } from "@/lib/profile";
import { MAX_PHOTO_BYTES, profileView } from "@/lib/profile-rules";
import type { ClubContact } from "@/lib/types";

// POST/DELETE /api/preferences/photo — the signed-in person's own profile photo.
// Same email-verified session and origin check as the rest of /preferences, plus
// a durable per-person daily limit shared with LinkedIn edits.
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function guard(req: Request) {
  if (!requestOriginAllowed(req)) return { error: json({ error: "Invalid request origin." }, 403) };
  const auth = await preferenceSession((await cookies()).get(PREFERENCE_COOKIE)?.value);
  if (!auth) return { error: json({ error: "Your preference session has expired." }, 401) };
  if (!(await chargeProfileChange(auth.contactId))) return { error: json({ error: "You have changed your profile several times today. Please try again tomorrow." }, 429) };
  return { auth };
}

async function view(contactId: string) {
  return profileView((await db().collection("clubContacts").doc(contactId).get()).data() as ClubContact | undefined);
}

export async function POST(req: Request) {
  // Reject an oversized body before reading it.
  if (Number(req.headers.get("content-length") || 0) > MAX_PHOTO_BYTES + 64 * 1024) return json({ error: "That photo is too large. Please use one under 4 MB." }, 413);
  const { auth, error } = await guard(req);
  if (error) return error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return json({ error: "Choose a photo to upload." }, 400);
  try {
    await setPhoto(auth.contactId, Buffer.from(await file.arrayBuffer()), "self");
  } catch (e) {
    if (e instanceof ProfileInputError) return json({ error: e.message }, 400);
    console.error("[preferences photo]", e);
    return json({ error: "Your photo could not be saved. Please try again." }, 500);
  }
  return json({ ok: true, profile: await view(auth.contactId) });
}

export async function DELETE(req: Request) {
  const { auth, error } = await guard(req);
  if (error) return error;
  await clearPhoto(auth.contactId);
  return json({ ok: true, profile: await view(auth.contactId) });
}
