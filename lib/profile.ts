import "server-only";
import sharp from "sharp";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { deleteStoredImage, uploadAvatar } from "@/lib/storage";
import { MAX_PHOTO_BYTES, parseLinkedInInput, sniffImage } from "@/lib/profile-rules";
import type { ClubContact } from "@/lib/types";

// Profile overrides set by the person (/preferences) or the admin. They exist so a
// wrong Exa match can always be corrected by a human, and once set they are never
// overwritten by registration sync or enrichment (see isLinkedInLocked).
const CONTACTS = "clubContacts";
export type ProfileEditor = "self" | "admin";
export class ProfileInputError extends Error {}

/**
 * Set or clear the LinkedIn URL. Everything derived from the OLD profile goes too:
 * its photo, pending guess, generated headline and the cached Exa text. Otherwise
 * a corrected URL would keep showing the wrong person's photo and feeding their
 * profile into matching until the 180-day cache aged out.
 */
export async function setLinkedIn(contactId: string, raw: string | null, by: ProfileEditor): Promise<string | null> {
  const url = raw === null || raw.trim() === "" ? null : parseLinkedInInput(raw);
  if (raw !== null && raw.trim() !== "" && !url) throw new ProfileInputError("Enter a LinkedIn profile link like linkedin.com/in/your-name.");
  const ref = db().collection(CONTACTS).doc(contactId);
  const current = (await ref.get()).data() as ClubContact | undefined;
  if (!current) throw new ProfileInputError("Profile not found.");
  if (url && url === current.linkedinUrl && current.linkedinConfidence === "given" && current.linkedinSource === by) return url;
  await ref.set(
    {
      ...(url
        ? { linkedinUrl: url, linkedinSource: by, linkedinConfidence: "given" }
        : { linkedinUrl: FieldValue.delete(), linkedinSource: FieldValue.delete(), linkedinConfidence: FieldValue.delete() }),
      linkedinPhoto: FieldValue.delete(),
      linkedinCandidate: FieldValue.delete(),
      headline: FieldValue.delete(),
      linkedinUpdatedAt: Date.now(),
      linkedinUpdatedBy: by,
    },
    { merge: true },
  );
  await ref.collection("signal").doc("exa").delete().catch(() => {});
  if (current.linkedinPhoto) await deleteStoredImage(current.linkedinPhoto);
  return url;
}

/** Accept an Exa guess as theirs (admin only). */
export async function confirmLinkedInCandidate(contactId: string): Promise<string> {
  const current = (await db().collection(CONTACTS).doc(contactId).get()).data() as ClubContact | undefined;
  const url = current?.linkedinCandidate?.url;
  if (!url) throw new ProfileInputError("There is no LinkedIn guess to confirm.");
  const set = await setLinkedIn(contactId, url, "admin");
  if (!set) throw new ProfileInputError("The guess is not a valid LinkedIn profile link.");
  return set;
}

/**
 * Reject an Exa guess. The rejection is cached so the nightly search does not
 * offer the same stranger again until the cache ages out.
 */
export async function rejectLinkedInCandidate(contactId: string): Promise<void> {
  const ref = db().collection(CONTACTS).doc(contactId);
  const current = (await ref.get()).data() as ClubContact | undefined;
  if (!current?.linkedinCandidate) return;
  await ref.collection("signal").doc("exa").set({
    fetchedAt: Date.now(),
    confidence: "low",
    url: current.linkedinCandidate.url,
    rejected: "not-found",
    rejectedBy: "admin",
  });
  await ref.set({ linkedinCandidate: FieldValue.delete() }, { merge: true });
}

/**
 * Store an uploaded photo. The bytes are sniffed (never the declared type), then
 * re-encoded to a square WebP, which strips EXIF/GPS metadata and anything that is
 * not a plain image.
 */
export async function setPhoto(contactId: string, bytes: Buffer, by: ProfileEditor): Promise<string> {
  if (!bytes.length) throw new ProfileInputError("Choose a photo to upload.");
  if (bytes.length > MAX_PHOTO_BYTES) throw new ProfileInputError("That photo is too large. Please use one under 4 MB.");
  if (!sniffImage(bytes)) throw new ProfileInputError("Please upload a JPG, PNG, or WebP photo.");
  let webp: Buffer;
  try {
    webp = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize(512, 512, { fit: "cover", position: "attention" }).webp({ quality: 84 }).toBuffer();
  } catch {
    throw new ProfileInputError("We could not read that image. Please try a different photo.");
  }
  const ref = db().collection(CONTACTS).doc(contactId);
  const current = (await ref.get()).data() as ClubContact | undefined;
  if (!current) throw new ProfileInputError("Profile not found.");
  const key = await uploadAvatar(`user-${contactId}`, { type: "image/webp", bytes: webp });
  const photoUrl = `/api/img/${key}`;
  await ref.set({ photoUrl, photoSource: by, photoUpdatedAt: Date.now() }, { merge: true });
  if (current.photoUrl && current.photoUrl !== photoUrl) await deleteStoredImage(current.photoUrl);
  return photoUrl;
}

export async function clearPhoto(contactId: string): Promise<void> {
  const ref = db().collection(CONTACTS).doc(contactId);
  const current = (await ref.get()).data() as ClubContact | undefined;
  if (!current?.photoUrl) return;
  await ref.set({ photoUrl: FieldValue.delete(), photoSource: FieldValue.delete(), photoUpdatedAt: Date.now() }, { merge: true });
  await deleteStoredImage(current.photoUrl);
}
