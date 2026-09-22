import { db } from "@/lib/firebase-admin";

// --- Per-IP rate limit (best-effort, in-memory; Fluid Compute reuses instances) ---
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  ip: string,
  key: string,
  limit = 10,
  windowMs = 60 * 60 * 1000,
): boolean {
  const id = `${key}:${ip}`;
  const now = Date.now();
  const cur = hits.get(id);
  if (!cur || now > cur.resetAt) {
    hits.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

export function clientIp(req: Request): string {
  // SECURITY: `x-forwarded-for` can carry client-supplied entries PREPENDED to the
  // real one, so taking its leftmost value lets an attacker rotate the header for a
  // fresh rate-limit bucket on every request (defeating every per-IP guard). On
  // Vercel `x-real-ip` and `x-vercel-forwarded-for` are set by the platform edge
  // and cannot be spoofed. Prefer those; only if neither is present (e.g. local
  // dev) fall back to the LAST hop of x-forwarded-for (appended by the nearest
  // trusted proxy), never the client-controlled leftmost.
  const trusted =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (trusted) return trusted;
  const hops =
    req.headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean) ?? [];
  return hops[hops.length - 1] || "unknown";
}

// --- Per-user hourly action cap (Firestore-backed, durable + shared across
// instances, unlike the in-memory `rateLimit` above). Fixed calendar-hour
// buckets keyed by uid, counted in a transaction so the cap holds even when
// Fluid Compute spreads a user's requests across instances. ---
function hourBucket(): string {
  return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH (UTC)
}

// Returns true if allowed (and counts it); false if the user is at the hourly
// cap for this action. Fails open on counter errors rather than blocking users.
export async function rateLimitUser(
  uid: string,
  kind: string,
  limit: number,
): Promise<boolean> {
  const ref = db().collection("ratelimit").doc(`${uid}_${hourBucket()}_${kind}`);
  try {
    return await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const used = (snap.data()?.count as number) ?? 0;
      if (used >= limit) return false;
      tx.set(ref, { count: used + 1, kind, uid, hour: hourBucket() }, { merge: true });
      return true;
    });
  } catch {
    return true;
  }
}

// --- Global daily budget kill switch (Firestore-backed, shared across instances) ---
const DAILY_CAP = Number(process.env.DAILY_ENRICH_CAP ?? 500);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Returns true if allowed (and counts it); false if the day's budget is spent.
// `cap` defaults to the shared DAILY_CAP but can be overridden per kind (e.g. a
// generous but finite ceiling on the public discover endpoint, distinct from the
// tighter enrich budget).
export async function spendBudget(kind = "enrich", cap = DAILY_CAP): Promise<boolean> {
  const ref = db().collection("budget").doc(`${today()}_${kind}`);
  try {
    return await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const used = (snap.data()?.count as number) ?? 0;
      if (used >= cap) return false;
      tx.set(ref, { count: used + 1, kind, day: today() }, { merge: true });
      return true;
    });
  } catch {
    // Fail open on counter errors rather than blocking all users.
    return true;
  }
}
