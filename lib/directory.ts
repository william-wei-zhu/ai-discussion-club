import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/firebase-admin";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

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
  return {
    name,
    ...(background ? { background } : {}),
    ...(trustedLinkedIn(contact.linkedinUrl, contact.linkedinConfidence)
      ? { linkedinUrl: trustedLinkedIn(contact.linkedinUrl, contact.linkedinConfidence) }
      : {}),
    ...(trustedPhotoUrl(contact.avatarUrl) ? { photoUrl: trustedPhotoUrl(contact.avatarUrl) } : {}),
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
    const snaps = await db().getAll(...refs, { fieldMask: ["name", "headline", "linkedinUrl", "linkedinConfidence", "avatarUrl"] });
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
