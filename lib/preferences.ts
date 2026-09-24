import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/email";

export const PREFERENCE_COOKIE = "club_preferences";
export const LINK_TTL_MS = 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 60 * 1000;

export { normalizeEmail };

export function preferenceToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function preferenceHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function validPreferenceToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,80}$/.test(value);
}

export function requestOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const configured = (process.env.APP_ALLOWED_ORIGINS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (configured.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origin);
      return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && (url.protocol === "http:" || url.protocol === "https:");
    } catch { return false; }
  }
  return false;
}

export function consentPatch(value: unknown): { enabled: boolean; updatedAt: number; source: "email-verified" } | null {
  if (typeof value !== "boolean") return null;
  return { enabled: value, updatedAt: Date.now(), source: "email-verified" };
}

export async function contactForEmail(email: string) {
  const snap = await db().collection("clubContacts").where("email", "==", email).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, data: snap.docs[0].data() as Record<string, unknown> };
}

function utcHour(now: number) { return new Date(now).toISOString().slice(0, 13); }
function utcDay(now: number) { return new Date(now).toISOString().slice(0, 10); }

/** Charges both durable email/hour and global/day limits atomically. Fails closed. */
export async function chargePreferenceEmail(email: string, ip: string, dailyCap: number, hourlyCap = 3, ipHourlyCap = 10): Promise<boolean> {
  const now = Date.now();
  const emailKey = preferenceHash(email);
  const hourly = db().collection("preferenceSendLimits").doc(`${utcHour(now)}_${emailKey}`);
  const ipHourly = db().collection("preferenceSendLimits").doc(`${utcHour(now)}_ip_${preferenceHash(ip)}`);
  const daily = db().collection("preferenceSendLimits").doc(`${utcDay(now)}_global`);
  try {
    return await db().runTransaction(async (tx) => {
      const [hourSnap, ipSnap, daySnap] = await Promise.all([tx.get(hourly), tx.get(ipHourly), tx.get(daily)]);
      const hourCount = Number(hourSnap.data()?.count || 0);
      const ipCount = Number(ipSnap.data()?.count || 0);
      const dayCount = Number(daySnap.data()?.count || 0);
      if (hourCount >= hourlyCap || ipCount >= ipHourlyCap || dayCount >= dailyCap) return false;
      tx.set(hourly, { count: hourCount + 1, hour: utcHour(now), kind: "preference-email" }, { merge: true });
      tx.set(ipHourly, { count: ipCount + 1, hour: utcHour(now), kind: "preference-email-ip" }, { merge: true });
      tx.set(daily, { count: dayCount + 1, day: utcDay(now), kind: "preference-email-global" }, { merge: true });
      return true;
    });
  } catch {
    return false;
  }
}

export async function preferenceSession(raw: string | undefined): Promise<{ email: string; contactId: string } | null> {
  if (!raw || !validPreferenceToken(raw)) return null;
  const ref = db().collection("preferenceSessions").doc(preferenceHash(raw));
  const snap = await ref.get();
  const data = snap.data();
  if (!data || typeof data.email !== "string" || typeof data.contactId !== "string" || Number(data.expiresAt) <= Date.now()) return null;
  return { email: data.email, contactId: data.contactId };
}

export async function memberEvents(contactId: string, email: string) {
  const [guestSnap, eventSnap] = await Promise.all([
    db().collectionGroup("guests").where("email", "==", email).get(),
    db().collection("clubEvents").orderBy("startAt", "desc").get(),
  ]);
  const guests = new Map<string, Record<string, unknown>>();
  for (const doc of guestSnap.docs) {
    const eventId = doc.ref.parent.parent?.id;
    if (eventId && doc.id === contactId) guests.set(eventId, doc.data());
  }
  return eventSnap.docs.flatMap((event) => {
    const data = event.data();
    const guest = guests.get(event.id);
    const host = Array.isArray(data.hosts) && data.hosts.some((h: Record<string, unknown>) => h.id === contactId || h.email === email);
    if (!(guest?.approvalStatus === "approved" || guest?.isHost === true || host)) return [];
    return [{ id: event.id, name: String(data.name || "Event"), startAt: Number(data.startAt || 0) }];
  });
}

/** Profile edits (LinkedIn or photo) per contact per UTC day. Durable and fails closed. */
export async function chargeProfileChange(contactId: string, dailyCap = 10): Promise<boolean> {
  const now = Date.now();
  const ref = db().collection("preferenceSendLimits").doc(`${utcDay(now)}_profile_${preferenceHash(contactId)}`);
  try {
    return await db().runTransaction(async (tx) => {
      const count = Number((await tx.get(ref)).data()?.count || 0);
      if (count >= dailyCap) return false;
      tx.set(ref, { count: count + 1, day: utcDay(now), kind: "profile-change" }, { merge: true });
      return true;
    });
  } catch {
    return false;
  }
}

export async function endPreferenceSession(raw: string | undefined): Promise<void> {
  if (!raw || !validPreferenceToken(raw)) return;
  await db().collection("preferenceSessions").doc(preferenceHash(raw)).delete().catch(() => {});
}
