import { createHash } from "crypto";
import { db } from "@/lib/firebase-admin";
import { aggregateDemographics, audienceGuestIds, dedupePeople, demographicQuestions, DIMENSIONS_VERSION, labelsFromAnswers, type AudienceSummary, type DemographicRow } from "@/lib/demographics";
import { extractEmployer } from "@/lib/gemini";
import { spendBudget } from "@/lib/guard";
import { cacheMatchesProfile, isTrustedLinkedIn, trustedLinkedInUrl } from "@/lib/profile-rules";
import { askChoices, JEV_MODEL, typesafeConfigured } from "@/lib/typesafe";
import type { ClubContact, ClubExaCache } from "@/lib/types";

// Per-contact audience labels (clubContacts/{id}/signal/demographics) and the
// aggregates built from them. See lib/demographics.ts for the privacy rules.

const CONTACTS = "clubContacts";
const EVENTS = "clubEvents";
export const META = "clubMeta";
const DAILY_TYPESAFE_CAP = Number(process.env.CLUB_DAILY_TYPESAFE_CAP ?? 2000);
const DAILY_GEMINI_CAP = Number(process.env.CLUB_DAILY_GEMINI_CAP ?? 800);

export type ContactDemographics = DemographicRow & {
  confidences?: Record<string, number>;
  model: string;
  version: number;
  sourceHash: string;
  builtAt: number;
};

function demographicsRef(contactId: string) {
  return db().collection(CONTACTS).doc(contactId).collection("signal").doc("demographics");
}

// What the classifier reads: the headline plus the LinkedIn text, the latter only
// when the profile is trusted to be this person (the same gate as match signals).
// An admin-pasted profile wins over a scrape.
async function profileText(contact: ClubContact): Promise<string> {
  const ref = db().collection(CONTACTS).doc(contact.id).collection("signal");
  const [exaSnap, manualSnap] = await Promise.all([ref.doc("exa").get(), ref.doc("manual").get()]);
  const manual = (manualSnap.data() as { text?: string } | undefined)?.text;
  let profile = manual;
  if (!profile && isTrustedLinkedIn(contact)) {
    const exa = exaSnap.data() as ClubExaCache | undefined;
    if (exa?.text && exa.confidence !== "low" && cacheMatchesProfile(exa.url, contact.linkedinUrl)) profile = exa.text;
  }
  const parts: string[] = [];
  if (contact.headline?.trim()) parts.push(`Headline: ${contact.headline.trim()}`);
  if (profile?.trim()) parts.push(`LinkedIn profile:\n${profile.trim().slice(0, 6000)}`);
  return parts.join("\n\n");
}

export type ClassifyResult = "built" | "cached" | "no-profile" | "budget" | "error" | "not-configured";

// Label one contact, skipping all model calls when nothing changed (sourceHash).
// Fails closed: without a key, or past the day's budget, nothing is guessed.
export async function classifyContact(contact: ClubContact, opts: { typesafeCap?: number; geminiCap?: number } = {}): Promise<ClassifyResult> {
  if (!typesafeConfigured()) return "not-configured";
  const text = await profileText(contact);
  const sourceHash = createHash("sha256").update(`${DIMENSIONS_VERSION}\n${JEV_MODEL}\n${text}`).digest("hex");
  const ref = demographicsRef(contact.id);
  const existing = (await ref.get()).data() as ContactDemographics | undefined;
  if (existing?.sourceHash === sourceHash) return "cached";
  if (!text) {
    await ref.set({ model: JEV_MODEL, version: DIMENSIONS_VERSION, sourceHash, builtAt: Date.now() } satisfies ContactDemographics);
    return "no-profile";
  }
  if (!(await spendBudget("club_typesafe", opts.typesafeCap ?? DAILY_TYPESAFE_CAP))) return "budget";
  try {
    const answers = await askChoices(text, demographicQuestions());
    const { labels, confidences } = labelsFromAnswers(answers);
    // The employer needs a generated name, which Jev does not do; it is a small
    // separate call, and it is skipped (not fatal) when the Gemini budget is spent.
    let employer = "";
    if (await spendBudget("club_gemini", opts.geminiCap ?? DAILY_GEMINI_CAP)) {
      employer = await extractEmployer(text).catch(() => "");
    }
    await ref.set({
      ...labels,
      ...(employer ? { employer } : {}),
      confidences,
      model: JEV_MODEL,
      version: DIMENSIONS_VERSION,
      sourceHash,
      builtAt: Date.now(),
    } satisfies ContactDemographics);
    return "built";
  } catch (e) {
    console.error("[audience classify]", contact.id, (e as Error).message);
    return "error";
  }
}

// Label everyone who has come to an event and has no labels yet, most engaged
// first. Bounded by a count and a wall-clock deadline; safe to re-run.
export async function classifyPending(opts: { limit?: number; deadlineMs?: number; typesafeCap?: number; geminiCap?: number; ids?: string[] } = {}): Promise<Record<ClassifyResult, number> & { considered: number }> {
  const out = { considered: 0, built: 0, cached: 0, "no-profile": 0, budget: 0, error: 0, "not-configured": 0 };
  if (!typesafeConfigured()) return { ...out, "not-configured": 1 };
  const limit = opts.limit ?? 100;
  const deadline = opts.deadlineMs ?? Date.now() + 200_000;
  let ids = opts.ids;
  if (!ids) {
    const snap = await db().collection(CONTACTS).where("eventApprovedCount", ">", 0).select().get();
    const all = snap.docs.map((d) => d.id);
    const missing: string[] = [];
    for (let i = 0; i < all.length; i += 300) {
      const chunk = all.slice(i, i + 300);
      const snaps = await db().getAll(...chunk.map(demographicsRef), { fieldMask: ["version"] });
      snaps.forEach((s, j) => { if (!s.exists || s.data()?.version !== DIMENSIONS_VERSION) missing.push(chunk[j]); });
    }
    ids = missing;
  }
  for (const id of ids) {
    if (out.built >= limit || Date.now() > deadline) break;
    const doc = await db().collection(CONTACTS).doc(id).get();
    if (!doc.exists) continue;
    out.considered++;
    const result = await classifyContact({ ...(doc.data() as ClubContact), id }, opts);
    out[result]++;
    if (result === "budget") break;
  }
  return out;
}

// One row per person: labels plus the trusted LinkedIn used to merge two Luma
// accounts of the same person (dedupePeople).
async function rowsFor(ids: string[]): Promise<DemographicRow[]> {
  const rows: (DemographicRow & { linkedinUrl?: string })[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 300) {
    const chunk = unique.slice(i, i + 300);
    if (!chunk.length) continue;
    const [labels, contacts] = await Promise.all([
      db().getAll(...chunk.map(demographicsRef)),
      db().getAll(...chunk.map((id) => db().collection(CONTACTS).doc(id)), { fieldMask: ["linkedinUrl", "linkedinConfidence"] }),
    ]);
    // A contact with no labels yet still counts toward the total, as unknown.
    labels.forEach((s, j) => rows.push({
      ...(s.exists ? (s.data() as DemographicRow) : {}),
      linkedinUrl: trustedLinkedInUrl((contacts[j].data() ?? {}) as Parameters<typeof trustedLinkedInUrl>[0]),
    }));
  }
  return dedupePeople(rows);
}

export type EventAudience = AudienceSummary & { event: { name: string; startAt?: number }; checkedIn: boolean };

export async function eventAudience(eventId: string): Promise<EventAudience | null> {
  const eventRef = db().collection(EVENTS).doc(eventId);
  const [eventSnap, guestSnap, optOutSnap] = await Promise.all([
    eventRef.get(),
    eventRef.collection("guests").select("approvalStatus", "isHost", "checkedInAt").get(),
    eventRef.collection("directoryConsent").where("enabled", "==", false).get(),
  ]);
  if (!eventSnap.exists) return null;
  const event = eventSnap.data() ?? {};
  const guests = guestSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ids = audienceGuestIds(guests, new Set(optOutSnap.docs.map((d) => d.id)));
  const checkedIn = ids.length > 0 && ids.every((id) => {
    const g = guests.find((x) => x.id === id) as { checkedInAt?: unknown } | undefined;
    return typeof g?.checkedInAt === "number" && g.checkedInAt > 0;
  });
  return {
    ...aggregateDemographics(await rowsFor(ids)),
    event: { name: String(event.name || "AI Discussion Club event"), ...(typeof event.startAt === "number" ? { startAt: event.startAt } : {}) },
    checkedIn,
  };
}

// --- Club-wide summary, precomputed -------------------------------------------
// Everyone who has been approved for at least one event, minus email opt-outs.
// Built by the hourly sync into clubMeta/audience so the public page reads one doc.

export type ClubAudience = AudienceSummary & { updatedAt: number };

export async function rebuildClubAudience(): Promise<ClubAudience> {
  const snap = await db().collection(CONTACTS).where("eventApprovedCount", ">", 0).select("emailOptOut").get();
  const ids = snap.docs.filter((d) => d.data().emailOptOut !== true).map((d) => d.id);
  const summary: ClubAudience = { ...aggregateDemographics(await rowsFor(ids)), updatedAt: Date.now() };
  await db().collection(META).doc("audience").set(summary);
  return summary;
}

export async function getClubAudience(): Promise<ClubAudience | null> {
  try {
    const data = (await db().collection(META).doc("audience").get()).data();
    return data ? (data as ClubAudience) : null;
  } catch {
    return null;
  }
}

// --- Homepage counts -------------------------------------------------------------

export type ClubStats = { calendarSubscribers: number; updatedAt: number };

export async function getClubStats(): Promise<ClubStats | null> {
  try {
    const data = (await db().collection(META).doc("stats").get()).data();
    return typeof data?.calendarSubscribers === "number" ? (data as ClubStats) : null;
  } catch {
    return null;
  }
}
