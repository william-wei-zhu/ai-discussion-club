import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "crypto";
import { db } from "@/lib/firebase-admin";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { profilePhoto } from "@/lib/profile-rules";
import { siteUrl } from "@/lib/site";
import { secret as serverSecret } from "@/lib/unsubscribe";

export const DIRECTORY_PAGE_SIZE = 12;
export const DIRECTORY_ACCESS = "directoryAccess";

export type DirectoryCard = {
  name: string;
  background?: string;
  linkedinUrl?: string;
  photoUrl?: string;
  isHost: boolean;
};

export function randomUrlToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// --- Fixed, recoverable links ------------------------------------------------
// The token is looked up by hash (tokenHash), but also stored encrypted
// (tokenEnc, AES-256-GCM) so admin can show the link any time and the connect job
// can reuse it. The key is derived from the existing server secret, so no new env.

function linkKey(secretValue = serverSecret()): Buffer | null {
  if (!secretValue) return null;
  return Buffer.from(hkdfSync("sha256", secretValue, "aidc-directory", "directory-link-v1", 32));
}

export function encryptToken(token: string, secretValue?: string): string | null {
  const key = linkKey(secretValue);
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(enc: unknown, secretValue?: string): string | null {
  const key = linkKey(secretValue);
  if (!key || typeof enc !== "string") return null;
  const [iv, tag, body] = enc.split(".").map((part) => Buffer.from(part ?? "", "base64url"));
  if (!iv?.length || !tag?.length || !body?.length) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const token = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
    return isDirectoryToken(token) ? token : null;
  } catch {
    return null;
  }
}

export function directoryUrl(token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/g/${token}`;
}

// The current link for an event, or null when there is none, it is revoked, or it
// predates tokenEnc (only its hash exists, so it cannot be shown again).
export async function directoryUrlFor(eventId: string): Promise<string | null> {
  const data = (await db().collection(DIRECTORY_ACCESS).doc(eventId).get()).data();
  if (data?.enabled !== true) return null;
  const token = decryptToken(data.tokenEnc);
  return token ? directoryUrl(token) : null;
}

// Create (or replace) the event's link. Replacing invalidates the old URL.
export async function issueDirectoryLink(eventId: string, by: string): Promise<{ url: string; version: number }> {
  const ref = db().collection(DIRECTORY_ACCESS).doc(eventId);
  const current = await ref.get();
  const token = randomUrlToken();
  const tokenEnc = encryptToken(token);
  if (!tokenEnc) throw new Error("No server secret is configured for directory links.");
  const now = Date.now();
  const version = Number(current.data()?.version || 0) + 1;
  await ref.set({
    tokenHash: hashToken(token), tokenEnc, enabled: true, version,
    ...(current.exists ? { rotatedAt: now, rotatedBy: by } : { createdAt: now, createdBy: by }),
  }, { merge: true });
  return { url: directoryUrl(token), version };
}

// For the connect job: reuse a fixed link, respect an admin revoke, and otherwise
// create one (or replace a legacy hash-only link once). Returns null when revoked.
export async function ensureDirectoryLink(eventId: string, by: string): Promise<string | null> {
  const data = (await db().collection(DIRECTORY_ACCESS).doc(eventId).get()).data();
  if (data && data.enabled !== true && data.revokedAt) return null;
  if (data?.enabled === true) {
    const token = decryptToken(data.tokenEnc);
    if (token) return directoryUrl(token);
  }
  return (await issueDirectoryLink(eventId, by)).url;
}

export function isDirectoryToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,80}$/.test(token);
}

export function trustedPhotoUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase();
    if (host === "images.lumacdn.com" || host.endsWith(".lumacdn.com")) return url.toString();
  } catch {}
  return undefined;
}

// A LinkedIn profile photo as the enrichment stores it: either the app's own GCS
// copy served by /api/img/avatars/..., or a direct https licdn.com image URL.
export function trustedLinkedInPhoto(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (/^\/api\/img\/avatars\/[A-Za-z0-9._\/-]+$/.test(raw) && !raw.includes("..")) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol === "https:" && (host === "licdn.com" || host.endsWith(".licdn.com"))) return url.toString();
  } catch {}
  return undefined;
}

export function trustedLinkedIn(raw: unknown, confidence: unknown): string | undefined {
  if (confidence !== "given" && confidence !== "high") return undefined;
  if (typeof raw !== "string") return undefined;
  return normalizeLinkedInUrl(raw) ?? undefined;
}

// Opt-out: every going guest and every host is listed unless they turned the
// directory off for this event in /preferences (a directoryConsent doc with
// enabled === false). No consent doc means listed.
export function visibleDirectoryMember(input: {
  approvalStatus?: unknown;
  isHost?: unknown;
  optedOut?: unknown;
}): boolean {
  return input.optedOut !== true &&
    (input.approvalStatus === "approved" || input.isHost === true);
}

export function toDirectoryCard(input: {
  guest: Record<string, unknown>;
  contact?: Record<string, unknown>;
}): DirectoryCard | null {
  const { guest, contact = {} } = input;
  if (!visibleDirectoryMember({
    approvalStatus: guest.approvalStatus,
    isHost: guest.isHost,
    optedOut: guest.optedOut,
  })) return null;
  const name = String(contact.name || guest.name || "").trim();
  if (!name) return null;
  const background = typeof contact.headline === "string" ? contact.headline.trim().slice(0, 180) : "";
  const linkedinUrl = trustedLinkedIn(contact.linkedinUrl, contact.linkedinConfidence);
  // Uploaded photo first, then the LinkedIn photo only when that LinkedIn is
  // trusted to be this person, then Luma (profilePhoto, shared with the emails).
  const photoUrl = profilePhoto(contact)?.url;
  return {
    name,
    ...(background ? { background } : {}),
    ...(linkedinUrl ? { linkedinUrl } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    isHost: guest.isHost === true,
  };
}

export async function directoryForToken(token: string): Promise<{
  event: { name: string; startAt?: number };
  members: DirectoryCard[];
} | null> {
  if (!isDirectoryToken(token)) return null;
  const access = await db().collection(DIRECTORY_ACCESS)
    .where("tokenHash", "==", hashToken(token)).limit(1).get();
  if (access.empty || access.docs[0].data().enabled !== true) return null;
  const eventId = access.docs[0].id;
  const eventRef = db().collection("clubEvents").doc(eventId);
  const [eventSnap, guestSnap, optOutSnap] = await Promise.all([
    eventRef.get(),
    eventRef.collection("guests").get(),
    eventRef.collection("directoryConsent").where("enabled", "==", false).get(),
  ]);
  if (!eventSnap.exists) return null;
  const optedOut = new Set(optOutSnap.docs.map((doc) => doc.id));
  const guests = guestSnap.docs.filter((doc) => {
    const g = doc.data();
    return !optedOut.has(doc.id) && (g.approvalStatus === "approved" || g.isHost === true);
  });
  const contacts = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < guests.length; i += 300) {
    const refs = guests.slice(i, i + 300).map((g) => db().collection("clubContacts").doc(g.id));
    if (!refs.length) continue;
    const snaps = await db().getAll(...refs, { fieldMask: ["name", "headline", "linkedinUrl", "linkedinConfidence", "linkedinPhoto", "avatarUrl", "photoUrl"] });
    for (const snap of snaps) if (snap.exists) contacts.set(snap.id, snap.data() as Record<string, unknown>);
  }
  const members = guests.flatMap((snap) => {
    const card = toDirectoryCard({
      guest: { ...snap.data(), optedOut: false },
      contact: contacts.get(snap.id),
    });
    return card ? [card] : [];
  }).sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.name.localeCompare(b.name));
  const event = eventSnap.data() ?? {};
  return { event: { name: String(event.name || "AI Discussion Club event"), ...(typeof event.startAt === "number" ? { startAt: event.startAt } : {}) }, members };
}
