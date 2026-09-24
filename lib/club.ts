/**
 * AI Discussion Club: the Firestore layer over Luma.
 *
 * Mirrors the Luma calendar into four server-only collections so that every read
 * surface (the /events admin page, the cron) hits Firestore and never Luma:
 *
 *   clubContacts/{user_api_id}                 the 1,100-person CRM roster
 *   clubContacts/{id}/signal/{current|exa}     vectors + raw enrichment cache
 *   clubEvents/{event_api_id}                  event mirror + per-event job state
 *   clubEvents/{eid}/guests/{user_api_id}      that event's registrations
 *   clubEvents/{eid}/recs/{user_api_id}        the computed "5 people to meet"
 *
 * Luma is called ONLY from the sync functions here (plus prepare/send), never
 * from a page render and never per table row, so the roster stays inside Luma's
 * rate limits. Staleness is made visible instead: every doc carries a syncedAt.
 */
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import {
  listCalendarPeople,
  listEvents,
  listEventGuests,
  linkedinFromAnswers,
  substantiveAnswers,
  guestKey,
  guestEmail,
  guestName,
  getEventWithHosts,
  hostKey,
  hostName,
  hostEmail,
  personKey,
  personEmail,
  personName,
  eventStartMs,
  type LumaEvent,
  type LumaGuest,
  type LumaCalendarPerson,
} from "@/lib/luma";
import type {
  ClubContact,
  ClubEvent,
  ClubEventCounts,
  ClubGuest,
  SignalTier,
} from "@/lib/types";

export const CONTACTS = "clubContacts";
export const EVENTS = "clubEvents";

// Arm the T-24h auto-send for newly synced events. On by default (steady state since
// 2026-09-24): every new event sends unless the admin disarms or pauses it. Set
// CLUB_AUTOSEND_DEFAULT=false to go back to arming each event by hand.
const AUTOSEND_DEFAULT = process.env.CLUB_AUTOSEND_DEFAULT !== "false";

export interface SyncSummary {
  events?: number;
  contacts?: number;
  created?: number;
  updated?: number;
  guests?: number;
  counts?: ClubEventCounts;
  linkedinPromoted?: number;
  hosts?: number;
  tags?: Record<string, number>;
}

// --- Events -----------------------------------------------------------------

function toClubEvent(e: LumaEvent, now: number): Omit<ClubEvent, "counts"> {
  const geo = e.geo_address_json ?? undefined;
  return {
    id: e.api_id,
    name: e.name ?? "",
    startAt: eventStartMs(e),
    startAtIso: e.start_at,
    endAtIso: e.end_at,
    timezone: e.timezone,
    url: e.url,
    coverUrl: e.cover_url,
    address: geo?.full_address ?? geo?.address ?? geo?.city_state ?? undefined,
    requireApproval: e.require_approval,
    visibility: e.visibility,
    registrationQuestions: (e.registration_questions ?? []).map((q) => ({
      id: q.id ?? "",
      label: q.label ?? "",
      questionType: q.question_type ?? "",
    })),
    syncedAt: now,
  };
}

/**
 * Upsert every event on the calendar (one Luma call, 18 rows today).
 *
 * Deliberately does NOT touch counts, guestsSyncedAt, or any job state: those are
 * owned by syncEventGuests and the cron. `autoSend` is written only on create, so
 * re-syncing never re-arms an event the admin disarmed.
 */
export async function syncEvents(): Promise<SyncSummary> {
  const events = await listEvents();
  const now = Date.now();
  const existing = new Set(
    (await db().collection(EVENTS).select().get()).docs.map((d) => d.id),
  );
  const writer = db().bulkWriter();
  let created = 0;
  for (const e of events) {
    if (!e.api_id) continue;
    const doc = toClubEvent(e, now);
    const isNew = !existing.has(e.api_id);
    if (isNew) created++;
    writer.set(
      db().collection(EVENTS).doc(e.api_id),
      isNew
        ? {
            ...doc,
            autoSend: AUTOSEND_DEFAULT,
            // Same audit trail setAutoSend leaves, so a default-armed event is traceable.
            ...(AUTOSEND_DEFAULT ? { autoSendArmedAt: now, autoSendArmedBy: "default" } : {}),
            counts: emptyCounts(),
          }
        : doc,
      { merge: true },
    );
  }
  await writer.close();
  return { events: events.length, created, updated: events.length - created };
}

function emptyCounts(): ClubEventCounts {
  return { total: 0, approved: 0, invited: 0, declined: 0, checkedIn: 0 };
}

// --- Contacts ---------------------------------------------------------------

function tagNames(p: LumaCalendarPerson): string[] {
  return (p.tags ?? []).map((t) => (t.name ?? "").trim()).filter(Boolean);
}

/**
 * Upsert the whole calendar roster (22 pages, ~15s for 1,103 people).
 *
 * firstSeenAt is written only on create, so a re-sync never resets it. Everything
 * else (tags, counts, name) is authoritative from Luma and overwritten. Fields we
 * own and Luma does not (linkedin*, signalTier, emailOptOut, recommendedTo) are
 * never mentioned, so merge:true leaves them intact.
 */
export async function syncContacts(): Promise<SyncSummary> {
  const people = await listCalendarPeople();
  const now = Date.now();
  const existing = new Set(
    (await db().collection(CONTACTS).select().get()).docs.map((d) => d.id),
  );
  const writer = db().bulkWriter();
  const tags: Record<string, number> = {};
  let created = 0;
  let written = 0;

  for (const p of people) {
    const id = personKey(p);
    const email = personEmail(p);
    if (!id || !email) continue; // unusable as a contact: no stable key or no way to reach them
    const names = tagNames(p);
    for (const t of names) tags[t] = (tags[t] ?? 0) + 1;
    const isNew = !existing.has(id);
    if (isNew) created++;
    const patch: Partial<ClubContact> & { id: string } = {
      id,
      name: personName(p),
      firstName: p.user?.first_name ?? undefined,
      lastName: p.user?.last_name ?? undefined,
      email,
      avatarUrl: p.user?.avatar_url ?? undefined,
      lumaPersonApiId: p.api_id ?? undefined,
      tags: names,
      eventApprovedCount: p.event_approved_count ?? 0,
      eventCheckedInCount: p.event_checked_in_count ?? 0,
      revenueUsdCents: p.revenue_usd_cents ?? 0,
      lastSyncedAt: now,
    };
    if (isNew) patch.firstSeenAt = Date.parse(p.created_at ?? "") || now;
    writer.set(db().collection(CONTACTS).doc(id), stripUndefined(patch), { merge: true });
    written++;
  }
  await writer.close();
  return { contacts: written, created, updated: written - created, tags };
}

// Firestore rejects undefined field values, and spreading optional Luma fields
// produces them freely. One guard beats a conditional per field.
function stripUndefined<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

// --- Guests -----------------------------------------------------------------

export function guestSignalTier(g: LumaGuest, hasTrustedLinkedIn: boolean): SignalTier {
  if (substantiveAnswers(g).length > 0) return "answers";
  return hasTrustedLinkedIn ? "linkedin" : "none";
}

/**
 * Upsert one event's guest list (22 pages, ~15s for 1,072 guests) and refresh the
 * event's counts.
 *
 * Also does two joins so nothing downstream dangles:
 *  - a guest with no clubContacts doc (invited but never a calendar member) gets a
 *    minimal contact created, so the recs join is always a straight id lookup;
 *  - a LinkedIn URL typed into a registration answer is promoted onto the contact
 *    as source "registration" / confidence "given", which is the most trustworthy
 *    source there is. It never downgrades an existing given/admin value.
 */
export async function syncEventGuests(eventApiId: string): Promise<SyncSummary> {
  const [guests, { hosts }] = await Promise.all([
    listEventGuests(eventApiId),
    // Hosts come from a DIFFERENT endpoint. Without this call the organizers look
    // like people who never confirmed, because that is how the guest list files them.
    getEventWithHosts(eventApiId).catch(() => ({ event: null, hosts: [] as Awaited<ReturnType<typeof getEventWithHosts>>["hosts"] })),
  ]);
  const hostIds = new Set(hosts.map(hostKey).filter((x): x is string => !!x));
  const now = Date.now();
  const counts = emptyCounts();

  const contactSnap = await db()
    .collection(CONTACTS)
    .select("linkedinUrl", "linkedinConfidence", "email")
    .get();
  const known = new Map(
    contactSnap.docs.map((d) => [d.id, d.data() as Pick<ClubContact, "linkedinUrl" | "linkedinConfidence" | "email">]),
  );

  const writer = db().bulkWriter();
  const guestsCol = db().collection(EVENTS).doc(eventApiId).collection("guests");
  let promoted = 0;
  let written = 0;

  for (const g of guests) {
    const id = guestKey(g);
    if (!id) continue;
    counts.total++;
    if (g.approval_status === "approved") counts.approved++;
    else if (g.approval_status === "invited") counts.invited++;
    else if (g.approval_status === "declined") counts.declined++;
    if (g.checked_in_at) counts.checkedIn++;

    const answers = substantiveAnswers(g);
    const li = linkedinFromAnswers(g);
    const contact = known.get(id);
    const trusted = !!(contact?.linkedinUrl && contact.linkedinConfidence !== "low") || !!li;

    const doc: ClubGuest = {
      id,
      guestApiId: g.api_id,
      name: guestName(g),
      email: guestEmail(g),
      approvalStatus: g.approval_status ?? "",
      registeredAt: Date.parse(g.registered_at ?? "") || undefined,
      createdAt: Date.parse(g.created_at ?? "") || undefined,
      checkedInAt: g.checked_in_at ? Date.parse(g.checked_in_at) || null : null,
      answers,
      linkedinFromAnswers: li ?? undefined,
      hasAnswers: answers.length > 0,
      ...(hostIds.has(id) ? { isHost: true } : {}),
      signalTier: guestSignalTier(g, trusted),
      syncedAt: now,
    };
    writer.set(guestsCol.doc(id), stripUndefined(doc as unknown as Record<string, unknown>), { merge: true });
    written++;

    // A guest who isn't on the calendar roster still needs a contact doc.
    if (!contact) {
      writer.set(
        db().collection(CONTACTS).doc(id),
        stripUndefined({
          id,
          name: guestName(g),
          email: guestEmail(g),
          tags: [],
          eventApprovedCount: 0,
          eventCheckedInCount: 0,
          firstSeenAt: doc.createdAt ?? now,
          lastSyncedAt: now,
        }),
        { merge: true },
      );
      known.set(id, { email: guestEmail(g) });
    }

    // Promote a self-typed LinkedIn URL. Never overwrite an equally-or-more
    // trusted value (given/admin), so an admin correction always wins.
    if (li && contact?.linkedinConfidence !== "given" && contact?.linkedinUrl !== li) {
      writer.set(
        db().collection(CONTACTS).doc(id),
        { linkedinUrl: li, linkedinSource: "registration", linkedinConfidence: "given" },
        { merge: true },
      );
      promoted++;
    }
  }

  // A host with no guest row at all (they never registered for their own event)
  // still has to be a recipient and a candidate.
  const guestIds = new Set(guests.map(guestKey).filter((x): x is string => !!x));
  for (const h of hosts) {
    const id = hostKey(h);
    if (!id || guestIds.has(id)) continue;
    writer.set(
      guestsCol.doc(id),
      stripUndefined({
        id,
        name: hostName(h),
        email: hostEmail(h),
        approvalStatus: "host",
        isHost: true,
        answers: [],
        hasAnswers: false,
        checkedInAt: null,
        syncedAt: now,
      }),
      { merge: true },
    );
    written++;
    if (!known.has(id)) {
      writer.set(
        db().collection(CONTACTS).doc(id),
        stripUndefined({
          id,
          name: hostName(h),
          email: hostEmail(h),
          avatarUrl: h.avatar_url ?? undefined,
          tags: [],
          eventApprovedCount: 0,
          eventCheckedInCount: 0,
          firstSeenAt: now,
          lastSyncedAt: now,
        }),
        { merge: true },
      );
      known.set(id, { email: hostEmail(h) });
    }
  }

  writer.set(
    db().collection(EVENTS).doc(eventApiId),
    {
      counts,
      guestsSyncedAt: now,
      hosts: hosts
        .filter((h) => hostKey(h))
        .map((h) => stripUndefined({ id: hostKey(h)!, name: hostName(h), email: hostEmail(h), avatarUrl: h.avatar_url ?? undefined })),
    },
    { merge: true },
  );
  await writer.close();
  return { guests: written, counts, linkedinPromoted: promoted, hosts: hosts.length };
}

/**
 * Backfill every event's guests, oldest first. This is the one expensive call
 * (18 events x up to 22 pages, several minutes), so it is script-only: the admin
 * UI syncs a single event at a time.
 */
export async function syncAllEventGuests(
  onProgress?: (eventId: string, name: string, s: SyncSummary) => void,
): Promise<SyncSummary> {
  const snap = await db().collection(EVENTS).orderBy("startAt", "asc").get();
  let guests = 0;
  let promoted = 0;
  for (const d of snap.docs) {
    const e = d.data() as ClubEvent;
    const s = await syncEventGuests(d.id);
    guests += s.guests ?? 0;
    promoted += s.linkedinPromoted ?? 0;
    onProgress?.(d.id, e.name, s);
  }
  return { events: snap.size, guests, linkedinPromoted: promoted };
}

// --- Reads (the /events page never touches Luma) ----------------------------

/**
 * How many of an event's attendees have never had their profile looked up.
 *
 * Counts contacts with no signalTier at all, i.e. nobody has run extraction for them
 * yet. Deliberately NOT "tier === none": that means we DID look and found nothing,
 * so looking again would just re-pay for the same answer.
 *
 * One field-masked getAll, and only ever called for upcoming events, because doing
 * it for all 18 would read every guest of every event on a page load.
 */
export async function countPendingLookup(eventId: string): Promise<number> {
  const guests = (await getEventGuests(eventId)).filter(
    (g) => g.approvalStatus === "approved" || g.isHost,
  );
  if (!guests.length) return 0;
  let never = 0;
  for (let i = 0; i < guests.length; i += 300) {
    const refs = guests.slice(i, i + 300).map((g) => db().collection(CONTACTS).doc(g.id));
    const snaps = await db().getAll(...refs, { fieldMask: ["signalTier"] });
    for (const sn of snaps) if (!(sn.data() as ClubContact | undefined)?.signalTier) never++;
  }
  return never;
}

export async function getEvents(): Promise<ClubEvent[]> {
  const snap = await db().collection(EVENTS).orderBy("startAt", "desc").get();
  return snap.docs.map((d) => ({ ...(d.data() as ClubEvent), id: d.id }));
}

export async function getEvent(eventId: string): Promise<ClubEvent | null> {
  const d = await db().collection(EVENTS).doc(eventId).get();
  return d.exists ? { ...(d.data() as ClubEvent), id: d.id } : null;
}

/** The next event that has not started yet, or null. */
export async function getNextEvent(now = Date.now()): Promise<ClubEvent | null> {
  const snap = await db()
    .collection(EVENTS)
    .where("startAt", ">", now)
    .orderBy("startAt", "asc")
    .limit(1)
    .get();
  return snap.empty ? null : { ...(snap.docs[0].data() as ClubEvent), id: snap.docs[0].id };
}

export async function getEventGuests(eventId: string): Promise<ClubGuest[]> {
  const snap = await db().collection(EVENTS).doc(eventId).collection("guests").get();
  return snap.docs
    .map((d) => ({ ...(d.data() as ClubGuest), id: d.id }))
    .sort((a, b) => Number(b.registeredAt ?? 0) - Number(a.registeredAt ?? 0));
}

/** One row of the participant export: exactly the three columns the sheet shows. */
export interface ParticipantRow {
  name: string;
  background: string;
  linkedin: string;
}

/**
 * The rows for the per-event participant spreadsheet, PURE so the join is testable
 * without Firestore. Everyone "in the room" (approved guests + hosts — the same test
 * the rest of the club code uses), joined to their CRM contact for the background and
 * LinkedIn columns.
 *
 * - background = the LinkedIn headline when we have one, else what the person wrote at
 *   registration (their goals / strengths). Guest `answers` are already substantive,
 *   trimmed strings by the time they reach the doc (`substantiveAnswers` drops blanks,
 *   the terms-waiver boolean and structural questions upstream), so we just join them.
 * - linkedin is emitted ONLY for a trusted profile (`given`/`high` confidence), the
 *   same rule the emails use — a wrong profile in a shared sheet has no recovery.
 * Sorted by name so the sheet reads as a clean roster.
 */
export function buildParticipantRows(
  guests: ClubGuest[],
  contactsById: Map<string, Pick<ClubContact, "name" | "headline" | "linkedinUrl" | "linkedinConfidence">>,
): ParticipantRow[] {
  return guests
    .filter((g) => g.approvalStatus === "approved" || g.isHost)
    .map((g) => {
      const c = contactsById.get(g.id);
      const headline = c?.headline?.trim();
      const fromAnswers = g.answers
        .map((a) => a.answer.trim())
        .filter(Boolean)
        .join(" · ");
      const trusted = c?.linkedinUrl && c.linkedinConfidence !== "low" ? c.linkedinUrl : "";
      return {
        name: (c?.name || g.name || "").trim(),
        background: headline || fromAnswers,
        linkedin: trusted,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export interface ContactQuery {
  q?: string;
  tag?: string;
  limit?: number;
  page?: number; // 1-based
}

/**
 * The CRM roster, paged. Never reads the signal subcollection, so vectors can
 * never leak into an API response.
 *
 * Search is a client-side-style filter over the page set rather than a Firestore
 * query because Firestore has no substring index; at 1,103 docs reading the
 * collection and filtering in JS is the same idiom app/api/admin/metrics uses,
 * and it is honest about the scaling limit rather than pretending to paginate a
 * search it cannot index.
 */
export async function getContacts(opts: ContactQuery = {}): Promise<{
  contacts: ClubContact[];
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 1000);
  const snap = await db().collection(CONTACTS).get();
  let all = snap.docs.map((d) => ({ ...(d.data() as ClubContact), id: d.id }));

  const q = (opts.q ?? "").trim().toLowerCase();
  if (q) {
    all = all.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.includes(q) ||
        c.linkedinUrl?.toLowerCase().includes(q),
    );
  }
  if (opts.tag) all = all.filter((c) => (c.tags ?? []).includes(opts.tag!));

  // Most engaged first, then most recent. Gives the admin a useful default view.
  all.sort(
    (a, b) =>
      (b.eventApprovedCount ?? 0) - (a.eventApprovedCount ?? 0) ||
      (b.firstSeenAt ?? 0) - (a.firstSeenAt ?? 0),
  );

  // Page-based rather than cursor-based: the whole set is already in memory (see
  // above), so real page numbers cost nothing and let the UI offer Prev/Next and
  // "page 3 of 60" instead of a one-way Load more.
  const pages = Math.max(1, Math.ceil(all.length / limit));
  const page = Math.min(Math.max(opts.page ?? 1, 1), pages);
  const start = (page - 1) * limit;
  return {
    contacts: all.slice(start, start + limit),
    total: all.length,
    page,
    pages,
    hasMore: page < pages,
  };
}

export interface ClubSummary {
  contacts: number;
  tags: Record<string, number>;
  withLinkedIn: number;
  optedOut: number;
  events: number;
  nextEvent?: {
    id: string;
    name: string;
    startAt: number;
    timezone?: string;
    hoursUntil: number;
    counts: ClubEventCounts;
    prepared: boolean;
    previewEmailedAt?: number;
    sent: number;
    cancelled: boolean;
    autoSend: boolean;
  };
  lastSyncedAt?: number;
}

/** Stat tiles for /events. One roster read plus one event read. */
export async function getSummary(): Promise<ClubSummary> {
  const [contactSnap, events] = await Promise.all([
    db().collection(CONTACTS).select("tags", "linkedinUrl", "linkedinConfidence", "emailOptOut", "lastSyncedAt").get(),
    getEvents(),
  ]);
  const tags: Record<string, number> = {};
  let withLinkedIn = 0;
  let optedOut = 0;
  let lastSyncedAt = 0;
  for (const d of contactSnap.docs) {
    const c = d.data() as ClubContact;
    for (const t of c.tags ?? []) tags[t] = (tags[t] ?? 0) + 1;
    if (c.linkedinUrl && c.linkedinConfidence !== "low") withLinkedIn++;
    if (c.emailOptOut) optedOut++;
    if ((c.lastSyncedAt ?? 0) > lastSyncedAt) lastSyncedAt = c.lastSyncedAt ?? 0;
  }
  const now = Date.now();
  const next = events.filter((e) => e.startAt > now).sort((a, b) => a.startAt - b.startAt)[0];
  return {
    contacts: contactSnap.size,
    tags,
    withLinkedIn,
    optedOut,
    events: events.length,
    lastSyncedAt: lastSyncedAt || undefined,
    nextEvent: next
      ? {
          id: next.id,
          name: next.name,
          startAt: next.startAt,
          timezone: next.timezone,
          hoursUntil: (next.startAt - now) / 3_600_000,
          counts: next.counts ?? emptyCounts(),
          prepared: !!next.prepare?.completedAt,
          previewEmailedAt: next.previewEmailedAt,
          sent: next.send?.sent ?? 0,
          cancelled: !!next.cancelled,
          autoSend: !!next.autoSend,
        }
      : undefined,
  };
}

// --- Enrichment + signal ----------------------------------------------------

import { createHash } from "crypto";
import { embed } from "@/lib/embeddings";
import { extractAsksOffers } from "@/lib/gemini";
import { fetchLinkedInProfile, findPeople } from "@/lib/exa";
import { normalizeLinkedInUrl, sameLinkedInHandle } from "@/lib/linkedin";
import { spendBudget } from "@/lib/guard";
import { importAvatarFromUrl } from "@/lib/storage";
import type { ClubExaCache, ClubSignal, Intent, LinkedInConfidence } from "@/lib/types";

const DAILY_EXA_CAP = Number(process.env.CLUB_DAILY_EXA_CAP ?? 300);
const DAILY_GEMINI_CAP = Number(process.env.CLUB_DAILY_GEMINI_CAP ?? 800);
const SIGNAL_TTL_DAYS = 90;
/**
 * How long a cached Exa enrichment is reused before we pay to look again.
 *
 * The cache is keyed PER CONTACT (clubContacts/{id}/signal/exa), not per event, so
 * the same person signing up for their fifth event costs zero Exa calls. But a
 * profile is a moving target (people change jobs, headlines and photos go stale), so
 * the cache is not immortal: past this age the next enrichment run refetches once
 * and the clock resets. Their linkedinUrl on the contact doc is permanent either
 * way, so a stale cache never means a lost link.
 */
const EXA_TTL_DAYS = Number(process.env.CLUB_EXA_TTL_DAYS ?? 180);

/** True when a cached lookup is young enough to reuse instead of re-paying for. */
export function isCacheFresh(fetchedAt: number | undefined, now = Date.now(), ttlDays = EXA_TTL_DAYS): boolean {
  if (!fetchedAt) return false;
  const age = now - fetchedAt;
  // A future timestamp means a clock problem, not freshness; refetch rather than
  // trusting it forever.
  if (age < 0) return false;
  return age < ttlDays * 86_400_000;
}

/**
 * Is this Exa hit the SAME human? First AND last name must both match, ignoring
 * case, diacritics, middle initials and suffixes.
 *
 * This is the guard that keeps a stranger's LinkedIn out of 99 emails. It is
 * deliberately strict: a near-miss becomes a reviewable candidate, not a link.
 */
export function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .toLowerCase()
      .replace(/\b(jr|sr|ii|iii|iv|phd|md|mba)\b\.?/g, "")
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1); // drops middle initials
  const pa = norm(a);
  const pb = norm(b);
  if (pa.length < 2 || pb.length < 2) return false;
  return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
}

/**
 * Copy a LinkedIn profile photo into our own bucket and return the stable
 * /api/img/avatars/... path.
 *
 * Never hotlink the media.licdn.com URL: it is signed and expires, so an email
 * opened a week later would show a broken image. importAvatarFromUrl is already
 * SSRF-hardened (licdn allowlist, re-validated per redirect hop), and returns null
 * for anything off-allowlist or non-image, which is exactly the "fall back to the
 * Luma avatar" signal.
 */
async function importProfilePhoto(contactId: string, imageUrl?: string): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const key = await importAvatarFromUrl(`club-${contactId}`, imageUrl);
    // uploadImage returns the bare storage key; the app serves it through the public
    // immutable-cached proxy, and the person-doc `photo` field stores that full path,
    // so match that convention rather than inventing a second one.
    if (key) return `/api/img/${key}`;
  } catch {
    // fall through to the direct URL
  }
  // The import can fail for reasons that have nothing to do with the image (a GCS
  // auth hiccup, for instance). Exa's LinkedIn photo URLs are signed but very
  // long-lived, and the licdn host check below is the same allowlist the importer
  // uses, so falling back to the direct URL keeps the photo rather than silently
  // dropping to the Luma default. Preference order stays: stored copy, then direct.
  try {
    const u = new URL(imageUrl);
    if (u.protocol === "https:" && /(^|\.)licdn\.com$/.test(u.hostname)) return u.toString();
  } catch {
    // not a usable URL
  }
  return null;
}

export interface EnrichSummary {
  considered: number;
  photos?: number;
  /** Caches that aged past CLUB_EXA_TTL_DAYS and were refetched. */
  refreshed?: number;
  exaCalls: number;
  confirmed: number;
  candidates: number;
  rejected: number;
  signalsBuilt: number;
  cacheHits: number;
  errors: number;
  budgetExhausted?: boolean;
}

/**
 * Find a LinkedIn profile for one contact by name, accepting it ONLY at high
 * confidence. Caches both hits and rejections in signal/exa so a re-run is free.
 */
async function enrichLinkedIn(
  contact: ClubContact,
  s: EnrichSummary,
): Promise<{ url?: string; confidence: LinkedInConfidence; headline?: string; text?: string } | null> {
  const cacheRef = db().collection(CONTACTS).doc(contact.id).collection("signal").doc("exa");
  const cached = (await cacheRef.get()).data() as ClubExaCache | undefined;
  // Reuse the cache until it ages out. This is the whole point of caching per
  // contact rather than per event: a returning regular costs nothing.
  if (cached && isCacheFresh(cached.fetchedAt)) {
    s.cacheHits++;
    if (cached.rejected) return null;
    // Backfill a missing photo from the CACHED image url, so adding the photo
    // feature to already-enriched contacts costs no new Exa lookups.
    if (!contact.linkedinPhoto && cached.image) {
      const photo = await importProfilePhoto(contact.id, cached.image);
      if (photo) {
        await db().collection(CONTACTS).doc(contact.id).set({ linkedinPhoto: photo }, { merge: true });
        s.photos = (s.photos ?? 0) + 1;
      }
    }
    return { url: cached.url, confidence: cached.confidence, headline: cached.headline, text: cached.text };
  }

  // Case A: we ALREADY trust their URL because they typed it into a Luma
  // registration form, but we have never read the profile. Fetch it once. Two
  // things were missing without this: the profile photo, and the profile TEXT,
  // which is why guests with a known LinkedIn but no registration answers were
  // still landing in the zero-signal bucket.
  if (contact.linkedinUrl && contact.linkedinConfidence !== "low") {
    if (cached) s.refreshed = (s.refreshed ?? 0) + 1; // aged out, paying again
    if (!(await spendBudget("club_exa", DAILY_EXA_CAP))) {
      s.budgetExhausted = true;
      return null;
    }
    s.exaCalls++;
    let raw;
    try {
      raw = await fetchLinkedInProfile(contact.linkedinUrl);
    } catch {
      s.errors++;
      return null;
    }
    const now = Date.now();
    if (!raw) {
      // Unreadable, but the URL is still theirs: cache the miss so we do not retry
      // every night, and keep the link (they gave it to us).
      await cacheRef.set({
        fetchedAt: now,
        confidence: contact.linkedinConfidence ?? "given",
        url: contact.linkedinUrl,
        rejected: "no-content",
      } satisfies ClubExaCache);
      return null;
    }
    const photo = await importProfilePhoto(contact.id, raw.image);
    await cacheRef.set(
      stripUndefined({
        url: contact.linkedinUrl,
        name: raw.name,
        text: raw.text.slice(0, 10_000),
        image: raw.image,
        fetchedAt: now,
        confidence: contact.linkedinConfidence ?? "given",
      }) as ClubExaCache,
    );
    if (photo) {
      await db().collection(CONTACTS).doc(contact.id).set({ linkedinPhoto: photo }, { merge: true });
      s.photos = (s.photos ?? 0) + 1;
    }
    s.confirmed++;
    return {
      url: contact.linkedinUrl,
      confidence: contact.linkedinConfidence ?? "given",
      text: raw.text.slice(0, 10_000),
    };
  }

  if (!(await spendBudget("club_exa", DAILY_EXA_CAP))) {
    s.budgetExhausted = true;
    return null;
  }

  // Search by name plus the club's context, which is the only disambiguator we
  // have. No email: Exa cannot search by it and it would leak PII into a query.
  const query = `${contact.name} Washington DC area AI`;
  s.exaCalls++;
  let candidates;
  try {
    candidates = await findPeople(query);
  } catch {
    s.errors++;
    return null;
  }

  const matches = candidates.filter((c) => namesMatch(contact.name, c.name));
  const now = Date.now();

  // Exactly one name match, or we cannot tell which human it is.
  if (matches.length !== 1) {
    const near = matches[0] ?? candidates[0];
    await cacheRef.set({
      fetchedAt: now,
      confidence: "low",
      searchQuery: query,
      rejected: matches.length === 0 ? "not-found" : "ambiguous",
      ...(near ? { url: near.linkedinUrl, name: near.name, headline: near.headline } : {}),
    } satisfies ClubExaCache);
    if (near) {
      await db().collection(CONTACTS).doc(contact.id).set(
        { linkedinCandidate: { url: near.linkedinUrl, name: near.name, headline: near.headline, foundAt: now } },
        { merge: true },
      );
      s.candidates++;
    } else {
      s.rejected++;
    }
    return null;
  }

  const hit = matches[0];
  const url = normalizeLinkedInUrl(hit.linkedinUrl);
  if (!url) {
    s.rejected++;
    await cacheRef.set({ fetchedAt: now, confidence: "low", searchQuery: query, rejected: "not-found" });
    return null;
  }

  // Pull the profile text. fetchLinkedInProfile already rejects Exa's
  // nearest-match handle swap (the documented wrong-profile bug).
  if (!(await spendBudget("club_exa", DAILY_EXA_CAP))) {
    s.budgetExhausted = true;
    return null;
  }
  s.exaCalls++;
  let raw;
  try {
    raw = await fetchLinkedInProfile(url);
  } catch {
    s.errors++;
    return null;
  }
  if (!raw || !sameLinkedInHandle(url, raw.url)) {
    s.rejected++;
    await cacheRef.set({ fetchedAt: now, confidence: "low", url, searchQuery: query, rejected: "no-content" });
    return null;
  }

  const cache: ClubExaCache = stripUndefined({
    url,
    name: hit.name,
    headline: hit.headline,
    text: raw.text.slice(0, 10_000),
    image: raw.image ?? hit.image,
    fetchedAt: now,
    confidence: "high",
    searchQuery: query,
  }) as ClubExaCache;
  await cacheRef.set(cache);
  const photo = await importProfilePhoto(contact.id, raw.image ?? hit.image);
  if (photo) s.photos = (s.photos ?? 0) + 1;
  await db().collection(CONTACTS).doc(contact.id).set(
    stripUndefined({
      linkedinUrl: url,
      linkedinSource: "exa_search",
      linkedinConfidence: "high",
      linkedinCandidate: FieldValue.delete(),
      ...(photo ? { linkedinPhoto: photo } : {}),
    }),
    { merge: true },
  );
  s.confirmed++;
  return { url, confidence: "high", headline: hit.headline, text: cache.text };
}

/**
 * Store a profile pasted in by the admin.
 *
 * The gap this closes: ~10% of contacts give us a LinkedIn URL we trust but whose
 * profile Exa cannot read (cached as rejected: "no-content"). We know who they are
 * and can link them, but we have no prose, so the matcher has nothing to rank and
 * they fall to serendipity picks. A human who can see the profile can paste it in
 * once, and it is treated as MORE authoritative than a scrape, because it is.
 *
 * Kept in its own signal/manual doc rather than overwriting the Exa cache, so a
 * later Exa refresh can never silently clobber it.
 */
export async function setManualProfile(contactId: string, text: string, by: string): Promise<void> {
  const clean = text.trim().slice(0, 12_000);
  const ref = db().collection(CONTACTS).doc(contactId);
  if (!clean) {
    await ref.collection("signal").doc("manual").delete().catch(() => {});
    return;
  }
  await ref.collection("signal").doc("manual").set({
    text: clean,
    enteredAt: Date.now(),
    enteredBy: by,
  });
  // The URL itself was already theirs; this only raises what we know about them.
  await ref.set({ linkedinSource: "admin" }, { merge: true });
}

export async function getManualProfile(contactId: string): Promise<string | undefined> {
  const d = await db().collection(CONTACTS).doc(contactId).collection("signal").doc("manual").get();
  return (d.data() as { text?: string } | undefined)?.text;
}

/**
 * Build the text we feed the extractor: the person's own registration answers
 * (most recent events first), then their LinkedIn profile text but ONLY when we
 * trust the profile is theirs.
 *
 * Confidence is one coupled decision on purpose: if we would not show the link, we
 * do not read the text either, because a wrong-person profile silently poisoning a
 * stranger's why-line is worse than a missing link.
 */
async function buildSignalText(
  contact: ClubContact,
  eventIds: string[],
  trustedProfileText?: string,
  manualProfileText?: string,
): Promise<{ text: string; tier: SignalTier; answers: string[] }> {
  // Read the guest docs by PATH, one getAll over known event ids.
  //
  // Deliberately not a collectionGroup("guests").where("id","==",...) query: a
  // collection-group query needs an explicitly declared index, which this project
  // does not have, so that version failed at runtime. It failed SILENTLY behind a
  // .catch(), which quietly degraded every contact to zero signal and produced 3
  // signals out of 25 with no error. Reading by path needs no index and cannot
  // half-work.
  const refs = eventIds.map((eid) => db().collection(EVENTS).doc(eid).collection("guests").doc(contact.id));
  const rows: ClubGuest[] = [];
  for (let i = 0; i < refs.length; i += 300) {
    const chunk = refs.slice(i, i + 300);
    if (!chunk.length) continue;
    const snaps = await db().getAll(...chunk);
    for (const sn of snaps) if (sn.exists) rows.push(sn.data() as ClubGuest);
  }

  const answers: string[] = [];
  const recent = rows
    .sort((a, b) => Number(b.registeredAt ?? 0) - Number(a.registeredAt ?? 0))
    .slice(0, 3); // this event plus the two most recent
  for (const g of recent) {
    for (const a of g.answers ?? []) answers.push(`Q: ${a.label}\nA: ${a.answer}`);
  }

  // An admin-pasted profile wins over a scrape: a human read the real page.
  const profile = manualProfileText || trustedProfileText;

  const parts = [`Name: ${contact.name}`];
  if (answers.length) parts.push(...answers);
  if (profile) parts.push(`LinkedIn profile:\n${profile.slice(0, 6000)}`);

  const tier: SignalTier = answers.length ? "answers" : profile ? "linkedin" : "none";
  return { text: parts.join("\n\n"), tier, answers };
}

function hashText(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Extract + embed one contact's asks/offers, skipping the work entirely when the
 * source text has not changed (sourceHash). This cache is what makes the steady
 * state cheap: a returning Core Audience member costs zero model calls at their
 * second event.
 */
async function buildSignal(contact: ClubContact, eventIds: string[], s: EnrichSummary): Promise<ClubSignal | null> {
  const contactRef = db().collection(CONTACTS).doc(contact.id);
  const signalRef = contactRef.collection("signal").doc("current");

  let profileText: string | undefined;
  if (contact.linkedinUrl && contact.linkedinConfidence !== "low") {
    const exa = (await contactRef.collection("signal").doc("exa").get()).data() as ClubExaCache | undefined;
    if (exa?.text && exa.confidence !== "low") profileText = exa.text;
  }
  // No URL-confidence gate on the manual text: a human pasted it deliberately, so
  // the wrong-person risk that gate exists for does not apply.
  const manualText = await getManualProfile(contact.id);

  const { text, tier } = await buildSignalText(contact, eventIds, profileText, manualText);
  const sourceHash = hashText(text);
  const existing = (await signalRef.get()).data() as ClubSignal | undefined;
  if (existing?.sourceHash === sourceHash) {
    s.cacheHits++;
    return existing;
  }

  if (tier === "none") {
    // Nothing to extract. Record the tier so prepare knows this person is dark
    // without re-deriving it, and never call a model for them.
    const empty: ClubSignal = { tier, sourceHash, asks: [], offers: [], builtAt: Date.now() };
    await signalRef.set(empty);
    await contactRef.set({ signalTier: tier }, { merge: true });
    return empty;
  }

  if (!(await spendBudget("club_gemini", DAILY_GEMINI_CAP))) {
    s.budgetExhausted = true;
    return existing ?? null;
  }

  let extracted;
  try {
    extracted = await extractAsksOffers(text);
  } catch {
    s.errors++;
    return existing ?? null;
  }

  const askTexts = (extracted.asks ?? []).filter(Boolean).slice(0, 4);
  const offerTexts = (extracted.offers ?? []).filter(Boolean).slice(0, 4);
  if (!askTexts.length && !offerTexts.length) {
    s.errors++;
    return existing ?? null;
  }

  let vectors: number[][];
  try {
    vectors = await embed([...askTexts, ...offerTexts]);
  } catch {
    s.errors++;
    return existing ?? null;
  }

  const expiresAt = Date.now() + SIGNAL_TTL_DAYS * 86_400_000;
  const toIntent = (prefix: string) => (t: string, i: number): Intent => ({
    id: `${prefix}:${i}`,
    text: t,
    embedding: vectors[prefix === "ask" ? i : askTexts.length + i] ?? [],
    active: true,
    expiresAt,
  });

  const signal: ClubSignal = {
    tier,
    sourceHash,
    asks: askTexts.map(toIntent("ask")),
    offers: offerTexts.map(toIntent("offer")),
    topAskText: askTexts[0],
    topOfferText: offerTexts[0],
    builtAt: Date.now(),
  };
  await signalRef.set(signal);
  await contactRef.set(
    { signalTier: tier, headline: extracted.headline || contact.headline || undefined },
    { merge: true },
  );
  s.signalsBuilt++;
  return signal;
}

/**
 * Enrich + build signal for a bounded batch of contacts, newest-registered first.
 *
 * Runs as a nightly cron so Exa is NEVER on the T-24h critical path, and takes a
 * wall-clock deadline so it stops cleanly rather than being killed mid-write.
 */
export async function enrichContacts(opts: {
  eventId?: string;
  /** Explicit targets, for rebuilding one person after an admin edit. */
  contactIds?: string[];
  limit?: number;
  deadlineMs?: number;
  skipExa?: boolean;
}): Promise<EnrichSummary> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 500);
  const deadline = opts.deadlineMs ?? Date.now() + 240_000;
  const s: EnrichSummary = {
    considered: 0,
    exaCalls: 0,
    confirmed: 0,
    candidates: 0,
    rejected: 0,
    signalsBuilt: 0,
    cacheHits: 0,
    errors: 0,
  };

  // Registration answers live on per-event guest docs, so signal building needs the
  // list of events to look in. Newest first: a person's recent answers describe them
  // better than a year-old one.
  const eventSnap = await db().collection(EVENTS).orderBy("startAt", "desc").limit(12).get();
  const eventIds = eventSnap.docs.map((d) => d.id);

  // Prefer the people who matter soonest: an upcoming event's confirmed guests.
  let ids: string[];
  if (opts.contactIds?.length) {
    ids = opts.contactIds;
  } else if (opts.eventId) {
    const guests = await getEventGuests(opts.eventId);
    // Hosts included: organizers are attending, and Luma reports them as "invited".
    ids = guests.filter((g) => g.approvalStatus === "approved" || g.isHost).map((g) => g.id);
  } else {
    const snap = await db().collection(CONTACTS).orderBy("eventApprovedCount", "desc").limit(limit * 4).get();
    ids = snap.docs.map((d) => d.id);
  }

  // Un-enriched contacts (no signal/current doc) go FIRST, so the tail of a large or
  // last-minute guest list is reached before a night's budget is spent re-touching
  // people we already built. The existence check is a cheap batched read; the Exa /
  // Gemini calls downstream still short-circuit on their own caches for the rest.
  if (ids.length > 1) {
    const missing: string[] = [];
    const have: string[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const snaps = await db().getAll(
        ...chunk.map((id) => db().collection(CONTACTS).doc(id).collection("signal").doc("current")),
      );
      snaps.forEach((snap, j) => (snap.exists ? have : missing).push(chunk[j]));
    }
    ids = [...missing, ...have];
  }

  let worked = 0;
  for (const id of ids) {
    if (worked >= limit) break;
    if (Date.now() > deadline) break;
    const doc = await db().collection(CONTACTS).doc(id).get();
    if (!doc.exists) continue;
    const contact = { ...(doc.data() as ClubContact), id: doc.id };

    // Per-contact isolation: one bad profile must never end the batch.
    const spendBefore = s.exaCalls + s.signalsBuilt;
    try {
      s.considered++;
      // Always ask, unless Exa is switched off: enrichLinkedIn handles all three
      // cases itself and short-circuits on its cache, so this costs nothing for a
      // contact we have already looked at. Gating it on "has no URL yet" was wrong,
      // because someone who typed their LinkedIn into a Luma form still needs their
      // profile TEXT (for signal) and their PHOTO fetched once.
      let profile: Awaited<ReturnType<typeof enrichLinkedIn>> = null;
      if (!opts.skipExa) profile = await enrichLinkedIn(contact, s);
      if (profile?.url) {
        contact.linkedinUrl = profile.url;
        contact.linkedinConfidence = profile.confidence;
      }
      await buildSignal(contact, eventIds, s);
    } catch (e) {
      s.errors++;
      console.error("[club enrich]", id, (e as Error).message);
    }
    // Only count against the cap when this contact actually did fresh work (a real
    // Exa or Gemini/embed call). A cached, unchanged contact costs nothing and must
    // not use up the run, or the un-enriched tail is never reached.
    if (s.exaCalls + s.signalsBuilt > spendBefore) worked++;
  }
  return s;
}

// --- Prepare: compute each confirmed guest's five ----------------------------

import { pickFive, exposureCap, recipientOrder, type ClubGuestSignal, type ClubPick } from "@/lib/club-match";
import { generateMeetLines } from "@/lib/gemini";
import { formatEventStart } from "@/lib/luma";
import { sendClubMeetEmail, sendClubPreviewEmail, type ClubMeetPerson, type ClubMeetParams } from "@/lib/resend";
import type { ClubRec, ClubRecPerson } from "@/lib/types";

const PER_RECIPIENT = 5;
// Public Luma profile base. The doc id IS the Luma user_api_id, so this needs no
// extra stored field. Verified: a real id renders the person, a bogus one 404s.
const LUMA_PROFILE_BASE = process.env.LUMA_PROFILE_BASE ?? "https://luma.com/user";
const MIN_PAIR_SCORE = Number(process.env.CLUB_MIN_PAIR_SCORE ?? 0.8);
const COOLDOWN_DAYS = Number(process.env.CLUB_COOLDOWN_DAYS ?? 120);
const MEET_LINE_CONCURRENCY = 5;

/**
 * Run `fn` over `items` with at most `limit` in flight, resolving errors as values
 * so one bad item can never reject the batch. Concurrency is new to this repo
 * (everything else is serial); it is what keeps ~60 Gemini calls at ~18s instead
 * of ~90s, comfortably inside the function ceiling.
 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<(R | Error)[]> {
  const out: (R | Error)[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i], i);
      } catch (e) {
        out[i] = e as Error;
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/** Load contact + signal for a set of ids, as the matcher's input shape. */
async function loadSignals(ids: string[]): Promise<Map<string, ClubGuestSignal & { email: string; contact: ClubContact }>> {
  const out = new Map<string, ClubGuestSignal & { email: string; contact: ClubContact }>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [contacts, signals] = await Promise.all([
      db().getAll(...chunk.map((id) => db().collection(CONTACTS).doc(id))),
      db().getAll(...chunk.map((id) => db().collection(CONTACTS).doc(id).collection("signal").doc("current"))),
    ]);
    for (let j = 0; j < chunk.length; j++) {
      const cs = contacts[j];
      if (!cs.exists) continue;
      const c = { ...(cs.data() as ClubContact), id: cs.id };
      const sig = signals[j]?.data() as ClubSignal | undefined;
      // Confidence gate: an unconfirmed profile contributes NEITHER a link nor text.
      const trusted = c.linkedinUrl && c.linkedinConfidence !== "low" ? c.linkedinUrl : undefined;
      // Prefer the LinkedIn photo when we trust the profile is theirs: it is the
      // picture the person chose to be recognised by professionally, and the Luma
      // avatar is very often a generated default. Luma is the fallback only.
      out.set(c.id, {
        id: c.id,
        name: c.name,
        headline: c.headline,
        avatarUrl: (trusted && c.linkedinPhoto) || c.avatarUrl,
        linkedinUrl: trusted,
        asks: sig?.asks ?? [],
        offers: sig?.offers ?? [],
        tier: sig?.tier ?? c.signalTier ?? "none",
        topAskText: sig?.topAskText,
        topOfferText: sig?.topOfferText,
        recommendedTo: c.recommendedTo ?? {},
        recommendedPairs: c.recommendedPairs ?? {},
        recommendedCount: c.recommendedCount ?? 0,
        optOut: !!c.emailOptOut || !!c.emailBouncedAt,
        email: c.email,
        contact: c,
      });
    }
  }
  return out;
}

/** The honest fallback line: the candidate's own words, or a neutral nudge. */
function extractiveLine(pick: ClubPick, cand: ClubGuestSignal): string {
  const text = (pick.anchorText ?? cand.topOfferText ?? cand.topAskText ?? "").trim();
  if (!text) return "New to the group, worth saying hello.";
  const trimmed = text.length > 110 ? `${text.slice(0, 107).trimEnd()}…` : text;
  return pick.basis === "mutual" ? trimmed : `Working on: ${trimmed}`;
}

export interface PrepareResult {
  eventId: string;
  recipients: number;
  withLinkedIn: number;
  zeroSignal: number;
  geminiFallbacks: number;
  shortLists: number;
  optedOut: number;
  done: boolean;
  remaining: number;
  previewSent?: boolean;
}

/**
 * Compute and persist the five for every confirmed guest, then (unless previewing
 * is suppressed) email the admin a preview.
 *
 * Resumable by construction: it takes a wall-clock deadline, writes each recipient's
 * rec doc as it goes, and reports `remaining` so the next cron tick can continue.
 * Per-recipient try/catch means one Gemini hiccup costs one line, never the run.
 * This is deliberately unlike cron/weekly-matches, whose unguarded per-member call
 * silently killed digests for everyone after the member that threw.
 */
export async function prepareEvent(opts: {
  eventId: string;
  deadlineMs?: number;
  sendPreview?: boolean;
  force?: boolean;
}): Promise<PrepareResult> {
  const deadline = opts.deadlineMs ?? Date.now() + 240_000;
  const event = await getEvent(opts.eventId);
  if (!event) throw new Error(`Unknown event ${opts.eventId}`);

  const eventRef = db().collection(EVENTS).doc(event.id);
  await eventRef.set({ prepare: { startedAt: Date.now() } }, { merge: true });

  const guests = await getEventGuests(event.id);
  // Organizers are in the room by definition, so they are recipients and candidates
  // exactly like a confirmed guest. Luma files them as "invited", which is why this
  // has to be explicit.
  const approved = guests.filter((g) => g.approvalStatus === "approved" || g.isHost);

  // Enrich-on-prepare (answers-only). The nightly club-enrich job may not have
  // reached every guest of a large or last-minute event by now, and a guest with no
  // signal/current doc is a zero-signal candidate: excluded from recommendations and,
  // as a recipient, served only weak coverage. Build a signal from their registration
  // answers here so they are ranked on what they actually told us. Exa stays OFF on
  // purpose: the slow LinkedIn lookup must never sit on the prepare/send critical path
  // (the reason club-enrich is a separate nightly job), and buildSignal reuses the
  // sourceHash cache, so a guest already built costs nothing.
  const approvedIds = approved.map((g) => g.id);
  const missingSignal: string[] = [];
  for (let i = 0; i < approvedIds.length; i += 200) {
    const chunk = approvedIds.slice(i, i + 200);
    const snaps = await db().getAll(
      ...chunk.map((id) => db().collection(CONTACTS).doc(id).collection("signal").doc("current")),
    );
    snaps.forEach((snap, j) => {
      if (!snap.exists) missingSignal.push(chunk[j]);
    });
  }
  if (missingSignal.length) {
    // Bounded so it can never eat the prepare deadline: what it does not finish, the
    // nightly job and the next prepare tick pick up.
    await enrichContacts({
      eventId: event.id,
      contactIds: missingSignal,
      skipExa: true,
      limit: missingSignal.length,
      deadlineMs: Math.min(deadline, Date.now() + 90_000),
    }).catch((e) => console.error("[club prepare] enrich-on-prepare failed", (e as Error).message));
  }

  const signals = await loadSignals(approved.map((g) => g.id));
  const pool: ClubGuestSignal[] = [...signals.values()];

  const recipients = pool.filter((p) => !p.optOut && signals.get(p.id)?.email);
  const optedOut = pool.length - recipients.length;
  // Base the exposure cap on the people who can actually be recommended (those with
  // some signal), not the raw guest count. pickFive excludes zero-signal guests as
  // recommendees, so counting them here would slacken the cap and let the known few
  // appear in more emails than intended.
  const recommendable = pool.filter((p) => p.asks.length > 0 || p.offers.length > 0).length;
  const cap = exposureCap(recipients.length, recommendable, PER_RECIPIENT);
  const exposure = new Map<string, number>();

  // Zero-signal recipients go FIRST.
  //
  // The exposure cap is a fixed pool of appearances, and greedy selection spends the
  // well-described people early. Whoever is processed last gets whatever is left
  // under the cap. A recipient who told us nothing can never get a reasoned match,
  // so a legible name is the only thing that makes their email worth opening: they
  // should not be the ones who lose that race. Within each group the order is still
  // hash-rotated per event, so no individual is permanently first or last.
  const dark = recipients.filter((r) => r.tier === "none").map((r) => r.id);
  const lit = recipients.filter((r) => r.tier !== "none").map((r) => r.id);
  const order = [...recipientOrder(dark, event.id), ...recipientOrder(lit, event.id)];

  const recsCol = eventRef.collection("recs");
  // Already-EMAILED recipients are never recomputed, even under force: their stored
  // rec must keep matching what they were actually sent, and overwriting it would
  // drop emailedAt and let the send phase email them a second time (the one failure
  // with no recovery). `force` rebuilds the recipients who already have an UNSENT rec
  // (e.g. after re-enrichment); without it, a resumed run also skips those, so it only
  // fills in recipients who have no rec yet.
  const recSnap = await recsCol.select("emailedAt").get();
  const emailedIds = recSnap.docs.filter((d) => d.data().emailedAt).map((d) => d.id);
  const existing = new Set(opts.force ? emailedIds : recSnap.docs.map((d) => d.id));

  let zeroSignal = 0;
  const now = Date.now();
  const built: { rec: ClubRec; recipient: ClubGuestSignal }[] = [];

  // --- Pass 1: selection. Sequential on purpose ---
  // pickFive mutates the shared `exposure` map, which is exactly how the cap stops
  // three people appearing in all 99 emails. Parallelising this would race on that
  // map and silently break the cap.
  type Enriched = ClubGuestSignal & { email: string; contact: ClubContact };
  const plan: { id: string; me: Enriched; picks: ClubPick[] }[] = [];
  for (const id of order) {
    if (existing.has(id)) continue; // emailed (always), or already built when not forcing
    const me = signals.get(id)!;
    const picks = pickFive(me, pool, {
      now,
      eventId: event.id,
      perRecipient: PER_RECIPIENT,
      exposure,
      exposureCap: cap,
      minScore: MIN_PAIR_SCORE,
      cooldownDays: COOLDOWN_DAYS,
    });
    if (me.tier === "none") zeroSignal++;
    plan.push({ id, me, picks });
  }

  // --- Pass 2: lines + writes. Concurrent, per-item isolated ---
  // Each recipient needs one Gemini call; at ~1.4s each, 99 recipients serial would
  // be ~2.5 minutes. Concurrency 5 brings it under 30s. Errors resolve as values,
  // so one failure costs that recipient's LLM line (it falls back to their own
  // words), never the run. This is the isolation cron/weekly-matches lacks.
  const results = await mapLimit(plan, MEET_LINE_CONCURRENCY, async (item) => {
    if (Date.now() > deadline) return null;
    const { id, me, picks } = item;

    // Only reason about a recipient we actually know something about. Asserting a
    // mutual fit for someone who told us nothing would be a fabrication.
    let lines: Record<string, string> = {};
    const canReason = me.asks.length > 0 || me.offers.length > 0;
    if (canReason && picks.length && (await spendBudget("club_gemini", DAILY_GEMINI_CAP))) {
      try {
        lines = await generateMeetLines(
          {
            name: me.name,
            headline: me.headline,
            about: [...me.asks.map((a) => a.text), ...me.offers.map((o) => o.text)].join("; "),
          },
          picks.map((p) => {
            const c = signals.get(p.id)!;
            return {
              id: p.id,
              name: c.name,
              headline: c.headline,
              about:
                [...c.asks.map((a) => a.text), ...c.offers.map((o) => o.text)].join("; ") || "No details given.",
            };
          }),
          event.name,
        );
      } catch {
        lines = {};
      }
    }

    const people: ClubRecPerson[] = picks.map((p) => {
      const c = signals.get(p.id)!;
      // Firestore rejects an undefined field value anywhere in the document, and
      // headline/linkedinUrl/avatarUrl are all genuinely optional. Omit rather than
      // set undefined: stripUndefined only walks top-level keys, not this array.
      return stripUndefined({
        id: p.id,
        name: c.name,
        why: lines[p.id] || extractiveLine(p, c),
        basis: p.basis,
        score: Number(p.score.toFixed(4)),
        ...(c.headline ? { headline: c.headline } : {}),
        ...(c.linkedinUrl
          ? { linkedinUrl: c.linkedinUrl }
          : { lumaUrl: `${LUMA_PROFILE_BASE}/${encodeURIComponent(p.id)}` }),
        ...(c.avatarUrl ? { avatarUrl: c.avatarUrl } : {}),
      }) as ClubRecPerson;
    });

    const rec: ClubRec = {
      recipientId: id,
      recipientName: me.name,
      recipientEmail: me.email,
      eventId: event.id,
      people,
      lineSource: Object.keys(lines).length ? "gemini" : "extractive",
      builtAt: Date.now(),
    };
    await recsCol.doc(id).set(rec);

    // Anti-repeat, stamped on BOTH contacts so the cooldown holds whichever way the
    // pair comes up next fortnight.
    const stamp: Record<string, number> = {};
    const pairs: Record<string, number> = {};
    for (const p of picks) {
      stamp[p.id] = now;
      pairs[p.id] = (me.recommendedPairs?.[p.id] ?? 0) + 1;
    }
    await db().collection(CONTACTS).doc(id).set({ recommendedTo: stamp, recommendedPairs: pairs }, { merge: true });
    await Promise.all(
      picks.map((p) =>
        db().collection(CONTACTS).doc(p.id).set(
          {
            recommendedTo: { [id]: now },
            recommendedPairs: { [id]: (signals.get(p.id)?.recommendedPairs?.[id] ?? 0) + 1 },
            recommendedCount: FieldValue.increment(1),
          },
          { merge: true },
        ),
      ),
    );
    return { rec, recipient: me };
  });

  let processed = existing.size;
  for (const r of results) {
    if (r instanceof Error) {
      console.error("[club prepare]", r.message);
      continue;
    }
    if (!r) continue; // deadline hit: the next tick picks it up
    built.push(r);
    processed++;
  }

  // Counted from the recs that actually persisted, so a failed or skipped recipient
  // never inflates the numbers the preview email reports.
  const withLinkedIn = built.reduce((n, b) => n + b.rec.people.filter((p) => p.linkedinUrl).length, 0);
  const geminiFallbacks = built.filter((b) => b.rec.lineSource === "extractive").length;
  // A short list means too few recommendable people existed for this recipient (the
  // rest of the pool was zero-signal and is no longer offered as filler). A cluster
  // of these is the new "degraded batch" signal, so surface it loudly rather than
  // letting a thin blast go out unnoticed.
  const shortLists = built.filter((b) => b.rec.people.length < PER_RECIPIENT).length;

  const done = processed >= order.length;
  if (done && recipients.length && (shortLists / recipients.length > 0.2 || zeroSignal / recipients.length > 0.4)) {
    console.warn(
      `[club prepare] DEGRADED ${event.id}: ${shortLists}/${recipients.length} short lists, ` +
        `${zeroSignal}/${recipients.length} zero-signal recipients. Enrichment may be incomplete.`,
    );
  }
  const result: PrepareResult = {
    eventId: event.id,
    recipients: order.length,
    withLinkedIn,
    zeroSignal,
    geminiFallbacks,
    shortLists,
    optedOut,
    done,
    remaining: Math.max(0, order.length - processed),
  };

  await eventRef.set(
    {
      prepare: {
        startedAt: Date.now(),
        ...(done ? { completedAt: Date.now() } : {}),
        recipients: order.length,
        withLinkedIn,
        zeroSignal,
        geminiFallbacks,
        shortLists,
      },
    },
    { merge: true },
  );

  if (done && opts.sendPreview && built.length) {
    const sample = built.find((b) => b.rec.people.length >= 3) ?? built[0];
    await sendClubPreviewEmail({
      eventName: event.name,
      eventWhen: formatEventStart({ start_at: event.startAtIso, timezone: event.timezone }),
      eventId: event.id,
      sendsAt: formatEventStart({
        start_at: new Date(event.startAt - 24 * 3_600_000).toISOString(),
        timezone: event.timezone,
      }),
      counts: {
        approved: approved.length,
        recipients: order.length,
        withLinkedIn,
        zeroSignal,
        geminiFallbacks,
        shortLists,
        exaCalls: 0,
        optedOut,
      },
      sample: toMeetParams(event, sample.rec),
    });
    await eventRef.set({ previewEmailedAt: Date.now() }, { merge: true });
    result.previewSent = true;
  }

  return result;
}

/** Turn a stored rec into the email's parameters. */
export function toMeetParams(event: ClubEvent, rec: ClubRec, test = false, testTo?: string): ClubMeetParams {
  return {
    toName: rec.recipientName,
    toEmail: rec.recipientEmail,
    toId: rec.recipientId,
    eventName: event.name,
    eventWhen: formatEventStart({ start_at: event.startAtIso, timezone: event.timezone }),
    eventUrl: event.url,
    venue: event.address,
    people: rec.people.map(
      (p): ClubMeetPerson => ({
        name: p.name,
        headline: p.headline,
        why: p.why,
        linkedinUrl: p.linkedinUrl,
        lumaUrl: p.lumaUrl,
        avatarUrl: p.avatarUrl,
      }),
    ),
    test,
    ...(testTo ? { testTo } : {}),
  };
}

/** Read one recipient's computed five. */
export async function getRec(eventId: string, recipientId: string): Promise<ClubRec | null> {
  const d = await db().collection(EVENTS).doc(eventId).collection("recs").doc(recipientId).get();
  return d.exists ? (d.data() as ClubRec) : null;
}

export async function getRecs(eventId: string): Promise<ClubRec[]> {
  const snap = await db().collection(EVENTS).doc(eventId).collection("recs").get();
  return snap.docs.map((d) => d.data() as ClubRec);
}

export class NotAConfirmedGuestError extends Error {}

/**
 * Resolve "send the <event> email to <email>" by name, and FAIL LOUDLY when that
 * person is not a confirmed guest of that event.
 *
 * This exists because of a real mistake: asked to send the Builder Nights email to
 * two people, I found they had only been *invited* to it (no recommendations
 * exist for a non-attendee), and instead of saying so I quietly switched to a
 * different event they had attended. sendTestCopy takes eventId and guestId as two
 * independent arguments, so nothing tied them to the request. This entry point ties
 * them together: one event, one email address, and a specific error rather than a
 * silent substitution.
 *
 * Returns their approval status in the error so the caller can say WHY, which is
 * the difference between "they never confirmed" and "wrong event".
 */
export async function resolveConfirmedGuest(
  eventId: string,
  email: string,
): Promise<{ id: string; name: string }> {
  const event = await getEvent(eventId);
  if (!event) throw new NotAConfirmedGuestError(`Unknown event ${eventId}.`);
  const wanted = email.trim().toLowerCase();
  const guests = await getEventGuests(eventId);
  const guest = guests.find((g) => (g.email ?? "").toLowerCase() === wanted);
  if (!guest) {
    throw new NotAConfirmedGuestError(
      `${email} is not on the guest list for "${event.name}", so there is no email to send them for it.`,
    );
  }
  if (guest.approvalStatus !== "approved" && !guest.isHost) {
    throw new NotAConfirmedGuestError(
      `${email} is "${guest.approvalStatus}" for "${event.name}", not approved, so no recommendations were computed for them. ` +
        `Confirm them in Luma and re-run prepare, or send them someone else's copy as a sample.`,
    );
  }
  return { id: guest.id, name: guest.name };
}

/**
 * Send one recipient's real email as a TEST, to the admin by default or to a
 * specific address. Always subject-prefixed [test] with a banner, so it can never
 * be mistaken for the live blast, and it never stamps emailedAt (so the real send
 * still owes this person their email).
 */
export async function sendTestCopy(eventId: string, recipientId: string, to?: string) {
  const [event, rec] = await Promise.all([getEvent(eventId), getRec(eventId, recipientId)]);
  if (!event) throw new Error("Unknown event.");
  if (!rec) throw new Error("No recommendations for that guest yet. Run prepare first.");
  const res = await sendClubMeetEmail(toMeetParams(event, rec, true, to));
  // Echo the event back to the caller. The event title previously appeared only
  // inside the Resend subject, so a send for the wrong event looked identical to a
  // correct one in any log or summary.
  return {
    res,
    eventId: event.id,
    eventName: event.name,
    recipientId,
    recipientName: rec.recipientName,
    sentTo: to ?? "admin",
  };
}

// --- Send: the T-24h blast, in resumable batches ----------------------------

// Emails per cron tick. 120 covers a whole event (99 confirmed for Aug 8, with room
// to grow) in ONE tick, rather than trickling across four hourly ones.
//
// This was 25 to dodge a possible 100/day Resend cap. That cap does not exist on
// this account (Pro: no daily limit, 50k/month, against ~200/month of real use), and
// the measured API rate limit is 10 req/s, not the 2/s an earlier comment here
// claimed. Batching now earns its keep only for resumability: a tick that dies costs
// one tick, and the send window is 23 hours wide.
const SEND_BATCH = Number(process.env.CLUB_SEND_BATCH ?? 120);
// ~3.3/s against a measured 10/s ceiling (ratelimit-policy: 10;w=1). Still a third
// of what is allowed, because the point is no longer the cap: it is that a domain
// which normally sends ~20/day should not fire 99 in one breath.
const SEND_PACING_MS = 300;
const CLAIM_STALE_MS = 15 * 60 * 1000;

export interface SendResult {
  eventId: string;
  sent: number;
  skipped: number;
  failed: number;
  remaining: number;
  done: boolean;
  reason?: string;
}

/**
 * Claim one recipient for sending, transactionally.
 *
 * Closes the check-then-set race between two overlapping cron ticks, which both
 * read emailedAt as unset and would both send. Emailing 197 people twice is the one
 * failure mode with no recovery, so it earns a transaction. A claim older than 15
 * minutes is treated as abandoned (the function that held it died), so a crash
 * mid-batch does not strand the recipient forever.
 */
async function claimRec(ref: FirebaseFirestore.DocumentReference, now: number): Promise<boolean> {
  try {
    return await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data() as ClubRec | undefined;
      if (!d || d.emailedAt) return false;
      if (d.claimedAt && now - d.claimedAt < CLAIM_STALE_MS) return false;
      tx.set(ref, { claimedAt: now }, { merge: true });
      return true;
    });
  } catch {
    return false;
  }
}

/**
 * Email one batch of an event's prepared recommendations.
 *
 * Deliberately batched rather than "send all 197 now": the domain normally sends
 * single digits a day, so the blast is paced across hourly cron ticks inside the
 * 23-hour send window. Re-syncs guests first so anyone who declined after prepare
 * is skipped, and stamps emailedAt per recipient so a re-run resumes rather than
 * repeats.
 */
export async function sendEventBlast(opts: {
  eventId: string;
  limit?: number;
  deadlineMs?: number;
  resync?: boolean;
  ignoreCancelled?: boolean;
}): Promise<SendResult> {
  const deadline = opts.deadlineMs ?? Date.now() + 240_000;
  const limit = Math.max(1, opts.limit ?? SEND_BATCH);
  const event = await getEvent(opts.eventId);
  if (!event) throw new Error(`Unknown event ${opts.eventId}`);

  const base: SendResult = { eventId: event.id, sent: 0, skipped: 0, failed: 0, remaining: 0, done: false };
  if (event.cancelled && !opts.ignoreCancelled) return { ...base, done: true, reason: "cancelled" };
  if (!event.prepare?.completedAt) return { ...base, reason: "not-prepared" };

  // Late declines: someone who dropped out between prepare and send must not be
  // told to go meet people at an event they are no longer attending.
  if (opts.resync !== false) await syncEventGuests(event.id);
  const approved = new Set(
    (await getEventGuests(event.id))
      .filter((g) => g.approvalStatus === "approved" || g.isHost)
      .map((g) => g.id),
  );

  const eventRef = db().collection(EVENTS).doc(event.id);
  const recsCol = eventRef.collection("recs");
  const all = await recsCol.get();
  const pending = all.docs.filter((d) => {
    const r = d.data() as ClubRec;
    return !r.emailedAt && !r.failedAt && r.people?.length;
  });

  const contactIds = new Set<string>();
  for (const doc of all.docs) {
    const rec = doc.data() as ClubRec;
    contactIds.add(rec.recipientId);
    for (const person of rec.people ?? []) contactIds.add(person.id);
  }
  const contactRefs = [...contactIds].map((id) => db().collection(CONTACTS).doc(id));
  const contactDocs = contactRefs.length ? await db().getAll(...contactRefs) : [];
  const contacts = new Map(contactDocs.map((doc) => [doc.id, doc.data() as ClubContact | undefined]));
  const recommendable = new Set(
    [...contactIds].filter((id) => approved.has(id) && contacts.get(id) && !contacts.get(id)?.emailOptOut),
  );

  await eventRef.set({ send: { startedAt: event.send?.startedAt ?? Date.now(), lastTickAt: Date.now() } }, { merge: true });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const seenEmails = new Set<string>();

  for (const doc of pending) {
    if (sent >= limit || Date.now() > deadline) break;
    const rec = doc.data() as ClubRec;

    if (!approved.has(rec.recipientId)) {
      skipped++;
      await doc.ref.set({ skippedAt: Date.now(), skipReason: "no-longer-approved" }, { merge: true });
      continue;
    }
    // Luma account merges can leave two contacts sharing one address; never send
    // the same person two different emails for the same event.
    const email = (rec.recipientEmail ?? "").toLowerCase();
    if (!email || seenEmails.has(email)) {
      skipped++;
      continue;
    }

    const contact = contacts.get(rec.recipientId);
    if (contact?.emailOptOut || contact?.emailBouncedAt) {
      skipped++;
      continue;
    }

    const currentPeople = filterSendablePeople(rec.people, approved, recommendable);
    if (!currentPeople.length) {
      skipped++;
      await doc.ref.set({ skippedAt: Date.now(), skipReason: "no-eligible-recommendations" }, { merge: true });
      continue;
    }

    if (!(await claimRec(doc.ref, Date.now()))) {
      skipped++;
      continue;
    }

    // Per-recipient isolation: one bad address never ends the blast.
    try {
      const res = await sendClubMeetEmail(toMeetParams(event, { ...rec, people: currentPeople }));
      const id = (res as { data?: { id?: string } })?.data?.id;
      await doc.ref.set(stripUndefined({ emailedAt: Date.now(), resendId: id }), { merge: true });
      seenEmails.add(email);
      sent++;
    } catch (e) {
      failed++;
      const message = (e as Error).message;
      console.error("[club send]", rec.recipientId, message);
      await doc.ref.set({ failedAt: Date.now(), error: message, claimedAt: FieldValue.delete() }, { merge: true });
      // A hard bounce should not be retried next event either.
      if (/invalid|bounce|not exist|rejected/i.test(message)) {
        await db().collection(CONTACTS).doc(rec.recipientId).set({ emailBouncedAt: Date.now() }, { merge: true });
      }
    }
    if (sent < limit) await new Promise((r) => setTimeout(r, SEND_PACING_MS));
  }

  const remaining = Math.max(0, pending.length - sent - skipped - failed);
  const done = remaining === 0;
  const prev = event.send ?? { sent: 0, skipped: 0, failed: 0, startedAt: Date.now() };
  await eventRef.set(
    {
      send: {
        startedAt: prev.startedAt ?? Date.now(),
        sent: (prev.sent ?? 0) + sent,
        skipped: (prev.skipped ?? 0) + skipped,
        failed: (prev.failed ?? 0) + failed,
        lastTickAt: Date.now(),
        ...(done ? { completedAt: Date.now() } : {}),
      },
    },
    { merge: true },
  );

  return { eventId: event.id, sent, skipped, failed, remaining, done };
}

export function filterSendablePeople<T extends { id: string }>(
  people: T[],
  approved: ReadonlySet<string>,
  recommendable: ReadonlySet<string>,
): T[] {
  return people.filter((person) => approved.has(person.id) && recommendable.has(person.id));
}

/**
 * Put someone back on the club list, or take them off by hand.
 *
 * The unsubscribe route is one-way: it only ever sets emailOptOut true, so before
 * this there was no path back short of editing Firestore. That is fine as a default
 * (an opt-out should be hard to undo) but wrong as an absolute, because people do
 * mis-click a one-click header button and then ask to be re-added.
 *
 * Re-adding is recorded (who, when) rather than silently flipping the flag: putting
 * someone back on a list they left is exactly the action that should leave a trace.
 * Only ever do it when the person asked.
 */
export async function setEmailOptOut(contactId: string, optOut: boolean, by: string): Promise<void> {
  const ref = db().collection(CONTACTS).doc(contactId);
  if (!(await ref.get()).exists) throw new Error("Unknown contact.");
  await ref.set(
    optOut
      ? { emailOptOut: true, optOutAt: Date.now() }
      : {
          emailOptOut: false,
          optOutAt: FieldValue.delete(),
          resubscribedAt: Date.now(),
          resubscribedBy: by,
        },
    { merge: true },
  );
}

/**
 * Clear a recorded send failure so this contact is tried again.
 *
 * A bounce also suppresses someone (loadSignals treats emailBouncedAt exactly like
 * an opt-out), and bounces are not always permanent: a full mailbox or a transient
 * provider rejection looks the same as a dead address at send time.
 */
export async function clearBounce(contactId: string, by: string): Promise<void> {
  const ref = db().collection(CONTACTS).doc(contactId);
  if (!(await ref.get()).exists) throw new Error("Unknown contact.");
  await ref.set(
    { emailBouncedAt: FieldValue.delete(), bounceClearedAt: Date.now(), resubscribedBy: by },
    { merge: true },
  );
}

/** Flip the cancel switch. Blocks only the SEND; prepare and the preview continue. */
export async function setCancelled(eventId: string, cancelled: boolean, by: string): Promise<void> {
  await db().collection(EVENTS).doc(eventId).set(
    cancelled
      ? { cancelled: true, cancelledAt: Date.now(), cancelledBy: by }
      : { cancelled: false, cancelledAt: FieldValue.delete(), cancelledBy: FieldValue.delete() },
    { merge: true },
  );
}

/**
 * Arm or disarm automatic sending, recording who did it and when.
 *
 * The timestamp is an AUDIT TRAIL, not a second condition: `autoSend` alone decides
 * whether the cron may send. I briefly required both, on the theory that an event
 * found carrying autoSend:true had no traceable cause. It had one, William pressed
 * the button, and the field simply did not exist yet. Requiring it would have
 * silently disarmed every event armed before this change, which is a far worse
 * failure than the one it was guarding against.
 */
export async function setAutoSend(eventId: string, autoSend: boolean, by = "admin"): Promise<void> {
  await db()
    .collection(EVENTS)
    .doc(eventId)
    .set(
      autoSend
        ? { autoSend: true, autoSendArmedAt: Date.now(), autoSendArmedBy: by }
        : { autoSend: false, autoSendArmedAt: FieldValue.delete(), autoSendArmedBy: FieldValue.delete() },
      { merge: true },
    );
}

/** Whether the cron may send this event's emails. */
export function isArmed(event: Pick<ClubEvent, "autoSend">): boolean {
  return !!event.autoSend;
}

// The coherent send-state helpers live in a client-safe module (no firebase-admin)
// so the admin UI and the server share one source of truth. Re-exported here for
// server callers that already import from lib/club.
export { willSendAutomatically, describeSendState, type SendState, type SendStateKind } from "@/lib/send-state";
