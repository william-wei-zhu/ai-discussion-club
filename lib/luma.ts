/**
 * The one Luma API client. Wraps the public REST API that backs the AI
 * Discussion Club calendar: the subscriber roster, the event list, and each
 * event's guest list (which is where registration answers live).
 *
 * Extracted from scripts/harvest-luma.ts so both that script and the runtime
 * (lib/club.ts, the cron, the /events admin routes) share one throttled,
 * retrying, typed client instead of two drifting copies.
 *
 * Two deliberate differences from the original script version:
 *
 *  1) An explicit User-Agent. Luma returns 403 (not 429, not 401) to requests
 *     with an unrecognized UA, and serverless fetch sends NO UA by default. Both
 *     `curl` and `tsx` send one, so without this the scripts work locally while
 *     the production cron 403s. Verified against the live API.
 *  2) The API key is read at CALL time, not module load. A module-level throw
 *     would break `next build` the moment a route imports this file.
 */
import { normalizeLinkedInUrl } from "@/lib/linkedin";

// Env-overridable so a host change is a config edit, not a code edit. Both
// "https://public-api.luma.com/v1" and "https://public-api.lu.ma/public/v1" serve
// the same API; the former is what the harvest script has always used.
export const LUMA_BASE = process.env.LUMA_API_BASE ?? "https://public-api.luma.com/v1";

const LUMA_UA = process.env.LUMA_USER_AGENT ?? "ai-discussion-club/1.0 (+https://aidiscussionclub.com)";

// --- Wire types (only the fields we actually read) ---

export interface LumaPage<T> {
  entries?: T[];
  has_more?: boolean;
  next_cursor?: string;
}

export interface LumaRegistrationQuestion {
  id?: string;
  label?: string;
  question_type?: string;
  required?: boolean;
}

export interface LumaEvent {
  api_id: string;
  name?: string;
  start_at?: string; // ISO-8601 UTC, e.g. "2026-08-08T19:00:00.000Z"
  end_at?: string;
  timezone?: string; // IANA, e.g. "America/New_York"
  url?: string;
  cover_url?: string;
  geo_address_json?: {
    full_address?: string;
    address?: string;
    city?: string;
    region?: string;
    city_state?: string;
  } | null;
  registration_questions?: LumaRegistrationQuestion[];
  require_approval?: boolean;
  spots_remaining?: number | null;
  visibility?: string;
}

export interface LumaTag {
  id?: string;
  name?: string;
}

/** A row from /calendar/list-people: the calendar MEMBERSHIP, which embeds the user. */
export interface LumaCalendarPerson {
  api_id?: string;
  id?: string;
  email?: string;
  created_at?: string;
  event_approved_count?: number;
  event_checked_in_count?: number;
  revenue_usd_cents?: number;
  tags?: LumaTag[];
  membership?: unknown;
  user?: {
    api_id?: string;
    id?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    avatar_url?: string;
  };
}

/**
 * An event HOST (organizer). Hosts are a first-class concept in Luma and are NOT
 * in the guest list as attendees: /event/get-guests reports them as "invited", so
 * an approved-only filter silently excludes the very people running the event.
 * They come from GET /event/get, which returns { event, hosts }.
 */
export interface LumaHost {
  api_id?: string;
  id?: string;
  email?: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

export interface LumaAnswer {
  question_id?: string;
  label?: string;
  question?: string;
  question_type?: string;
  answer?: string;
  value?: string;
  text?: string;
}

// Luma's own statuses, kept open so an unknown future value doesn't break typing.
export type LumaApprovalStatus = "approved" | "invited" | "declined" | (string & {});

export interface LumaGuest {
  api_id?: string; // gst-... , per EVENT (changes across events)
  user_api_id?: string; // usr-... , per PERSON (stable across events)
  approval_status?: LumaApprovalStatus;
  registered_at?: string;
  created_at?: string;
  checked_in_at?: string | null;
  name?: string;
  email?: string;
  user_name?: string;
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
  registration_answers?: LumaAnswer[];
  check_in_qr_code?: string;
  phone_number?: string;
}

// --- Transport ---

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function lumaConfigured(): boolean {
  return !!process.env.LUMA_API_KEY;
}

/**
 * GET one path, with a 429 retry budget sized for real contention.
 *
 * The original script's budget (6 attempts, linear 2s..12s = 42s total) is enough
 * for one client walking one list, but it exhausts the moment TWO walks overlap,
 * which is exactly what happens when the hourly cron re-syncs guests while the
 * admin presses Sync. Measured: two concurrent 22-page walks blew through it.
 * So: 8 attempts, exponential with jitter, and honour Retry-After when Luma sends
 * it (~5 minutes of patience worst case, still inside a 300s route only because
 * the phases carry their own wall-clock deadline and resume on the next tick).
 *
 * 429 is retried; every other non-ok status is permanent and surfaces verbatim
 * ("Luma /path -> 403"), because 403 here means a rejected User-Agent or a bad
 * key, and retrying that eight times just delays a clear error.
 */
export async function lumaGet<T>(path: string): Promise<T> {
  const key = process.env.LUMA_API_KEY;
  if (!key) throw new Error("LUMA_API_KEY not set");
  const attempts = 8;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(`${LUMA_BASE}${path}`, {
      headers: {
        "x-luma-api-key": key,
        accept: "application/json",
        "User-Agent": LUMA_UA,
      },
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 60_000)
        : Math.min(1500 * 2 ** attempt, 30_000) + Math.floor(Math.random() * 500);
      await sleep(backoff);
      continue;
    }
    if (!res.ok) {
      const hint = res.status === 403 ? " (403 usually means a rejected User-Agent or a bad LUMA_API_KEY)" : "";
      throw new Error(`Luma ${path} -> ${res.status}${hint}`);
    }
    await sleep(250); // gentle throttle so a 22-page walk doesn't trip the limiter
    return (await res.json()) as T;
  }
  throw new Error(`Luma ${path} -> rate limited after ${attempts} retries`);
}

// Page through an endpoint that returns { entries, has_more, next_cursor }.
// Page size is 50. The 200-page cap is a runaway guard (10k rows), far above the
// largest real list (1,072 guests = 22 pages).
export async function pageAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let cursor = "";
  for (let i = 0; i < 200; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const url = cursor ? `${path}${sep}pagination_cursor=${encodeURIComponent(cursor)}` : path;
    const d = await lumaGet<LumaPage<T>>(url);
    out.push(...(d.entries ?? []));
    if (!d.has_more || !d.next_cursor) break;
    cursor = d.next_cursor;
  }
  return out;
}

export async function listEvents(): Promise<LumaEvent[]> {
  // list-events wraps each row as { api_id, event: {...} }; older shapes are flat.
  const rows = await pageAll<{ api_id?: string; event?: LumaEvent } & LumaEvent>(
    "/calendar/list-events",
  );
  return rows.map((r) => (r.event ? { ...r.event, api_id: r.event.api_id ?? r.api_id! } : r));
}

export async function listCalendarPeople(): Promise<LumaCalendarPerson[]> {
  return pageAll<LumaCalendarPerson>("/calendar/list-people");
}

/**
 * One event plus its hosts.
 *
 * Separate call because neither /calendar/list-events nor /event/get-guests carries
 * host information: the first omits it, the second files hosts under "invited".
 */
export async function getEventWithHosts(
  eventApiId: string,
): Promise<{ event: LumaEvent | null; hosts: LumaHost[] }> {
  const d = await lumaGet<{ event?: LumaEvent; hosts?: LumaHost[] }>(
    `/event/get?api_id=${encodeURIComponent(eventApiId)}`,
  );
  return { event: d.event ?? null, hosts: d.hosts ?? [] };
}

export function hostKey(h: LumaHost): string | null {
  return h.api_id ?? h.id ?? null;
}

export function hostName(h: LumaHost): string {
  const full = (h.name ?? "").trim();
  if (full) return full;
  const parts = [h.first_name ?? "", h.last_name ?? ""].map((x) => x.trim()).filter(Boolean);
  // Luma leaves name null on some host records; fall back to the email local part
  // rather than rendering an empty name into an email.
  return parts.join(" ") || (h.email ?? "").split("@")[0] || "";
}

export function hostEmail(h: LumaHost): string {
  return (h.email ?? "").trim().toLowerCase();
}

export async function listEventGuests(eventApiId: string): Promise<LumaGuest[]> {
  const rows = await pageAll<{ guest?: LumaGuest } & LumaGuest>(
    `/event/get-guests?event_api_id=${encodeURIComponent(eventApiId)}`,
  );
  return rows.map(unwrapGuest);
}

// --- Pure helpers (no network, unit-tested) ---

// get-guests has returned both { guest: {...} } and a flat guest over time.
export function unwrapGuest(entry: unknown): LumaGuest {
  const e = (entry ?? {}) as { guest?: LumaGuest } & LumaGuest;
  return e.guest ?? e;
}

/** The stable per-person key. Doc ids for clubContacts and per-event guests. */
export function guestKey(g: LumaGuest): string | null {
  return g.user_api_id ?? null;
}

export function guestName(g: LumaGuest): string {
  return (g.name ?? g.user_name ?? "").trim();
}

export function guestEmail(g: LumaGuest): string {
  return (g.email ?? g.user_email ?? "").trim().toLowerCase();
}

export function isApproved(g: LumaGuest): boolean {
  return g.approval_status === "approved";
}

export function personKey(p: LumaCalendarPerson): string | null {
  return p.user?.api_id ?? p.api_id ?? p.id ?? null;
}

export function personName(p: LumaCalendarPerson): string {
  // The name lives on the embedded user; the `name` fallback mirrors the original
  // harvest script in case a membership row ever carries one directly.
  const flat = (p as LumaCalendarPerson & { name?: string }).name;
  return (p.user?.name ?? flat ?? "").trim();
}

export function personEmail(p: LumaCalendarPerson): string {
  return (p.email ?? p.user?.email ?? "").trim().toLowerCase();
}

const LINKEDIN_RE = /linkedin\.com\/in\/[^/\s]+/i;

/** True when an answer is the LinkedIn question (by Luma's type, or by label). */
function isLinkedInQuestion(a: LumaAnswer): boolean {
  const label = (a?.label || a?.question || "").toLowerCase();
  const qtype = (a?.question_type || "").toLowerCase();
  return qtype === "linkedin" || label.includes("linkedin");
}

// Luma stores LinkedIn answers as a path like "/in/handle", sometimes a full URL.
export function linkedinFromAnswers(g: Pick<LumaGuest, "registration_answers">): string | null {
  const ra = g.registration_answers;
  if (!Array.isArray(ra)) return null;
  for (const a of ra) {
    if (!isLinkedInQuestion(a)) continue;
    const url = normalizeLinkedInUrl(a?.answer ?? a?.value ?? a?.text ?? "");
    if (url) return url;
  }
  return null;
}

/** True when a normalized LinkedIn URL points at a real /in/ profile. */
export function isProfileUrl(url: string | null | undefined): boolean {
  return !!url && LINKEDIN_RE.test(url);
}

export interface GuestAnswer {
  questionId: string;
  label: string;
  answer: string;
}

// Question types that are structured data, not prose: they carry no matching
// signal and their values aren't even strings. Found the hard way: a "terms"
// waiver checkbox answers `true`, which is why any answer reader must coerce
// rather than assume a string.
const NON_PROSE_QUESTION_TYPES = new Set(["linkedin", "terms", "waiver", "phone", "phone-number"]);

/**
 * Coerce a Luma answer value to prose, or "" when it carries no prose.
 *
 * Real observed shapes: string (the normal case), null (question shown but left
 * blank), boolean (a terms checkbox), and arrays for multi-select. A boolean or an
 * object is not something a human wrote about themselves, so it becomes "" rather
 * than "true" or "[object Object]" polluting the embedding.
 */
function toAnswerText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join(", ").trim();
  return "";
}

/**
 * The registration answers worth feeding to the matcher: real prose, long enough
 * to carry meaning, and NOT a structural question (LinkedIn, phone, terms), which
 * are routed out here and read separately by linkedinFromAnswers.
 * Uses the same LinkedIn predicate as linkedinFromAnswers so the two can't disagree.
 */
export function substantiveAnswers(g: LumaGuest, minChars = 20): GuestAnswer[] {
  const ra = g.registration_answers;
  if (!Array.isArray(ra)) return [];
  const out: GuestAnswer[] = [];
  for (const a of ra) {
    if (isLinkedInQuestion(a)) continue;
    if (NON_PROSE_QUESTION_TYPES.has((a?.question_type || "").toLowerCase())) continue;
    const label = (a?.label || a?.question || "").trim();
    if (/\b(phone|mobile|telephone|terms and conditions|waiver)\b/i.test(label)) continue;
    const answer = toAnswerText(a?.answer ?? a?.value ?? a?.text);
    if (answer.length < minChars) continue;
    out.push({ questionId: (a?.question_id ?? "").trim(), label, answer });
  }
  return out;
}

/** ms epoch for an event's start. NaN-safe: returns 0 when unparseable. */
export function eventStartMs(e: Pick<LumaEvent, "start_at">): number {
  const ms = Date.parse(e.start_at ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

/** Hours from `now` until `startMs`. Negative once the event has started. */
export function hoursUntil(startMs: number, now = Date.now()): number {
  return (startMs - now) / 3_600_000;
}

/** "Saturday, Aug 8 at 3:00 PM EDT", rendered in the EVENT's own timezone. */
export function formatEventStart(e: Pick<LumaEvent, "start_at" | "timezone">): string {
  const ms = eventStartMs(e);
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: e.timezone || "UTC",
    }).format(new Date(ms));
  } catch {
    // Unknown IANA zone: fall back to UTC rather than throwing inside an email build.
    return new Date(ms).toUTCString();
  }
}
