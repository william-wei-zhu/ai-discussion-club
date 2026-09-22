/**
 * Who should meet whom at an AI Discussion Club event.
 *
 * PURE: no Firestore, no network, no Gemini, no clock of its own. Everything comes
 * in as arguments, which is what makes the whole selection policy unit-testable
 * (tests/club-match.test.ts) rather than only observable by sending 99 emails.
 *
 * Scoring itself is the app's existing mutualScore (lib/matcher.ts) over Intent[],
 * so a Luma guest is ranked by exactly the same complementarity math as a member.
 * What is new here is the SELECTION policy on top of the ranking:
 *
 *   1. mutual slots   strong two-way fits, the reason the email is worth reading
 *   2. coverage slots deliberate serendipity, so nobody is invisible
 *   3. exposure cap   nobody appears in everyone's email
 *   4. cooldown       a returning regular meets new people each fortnight
 */
import { mutualScore } from "@/lib/matcher";
import type { Intent, SignalTier } from "@/lib/types";

const DAY = 86_400_000;

export interface ClubGuestSignal {
  id: string;
  name: string;
  headline?: string;
  avatarUrl?: string;
  /** Already confidence-gated by the caller: present means safe to put in an email. */
  linkedinUrl?: string;
  asks: Intent[];
  offers: Intent[];
  tier: SignalTier;
  /** Their own words, for the extractive why-line when no LLM line is available. */
  topAskText?: string;
  topOfferText?: string;
  /** otherId -> last time the pair was recommended (either direction). */
  recommendedTo: Record<string, number>;
  /** otherId -> how many times the pair has been surfaced. */
  recommendedPairs: Record<string, number>;
  /** How many times this person has been recommended TO someone, all time. */
  recommendedCount: number;
  optOut: boolean;
}

export interface ClubPick {
  id: string;
  score: number;
  balance: number;
  basis: "mutual" | "coverage";
  /** The candidate text that drove the pick, for the extractive fallback line. */
  anchorText?: string;
}

export interface PickOptions {
  now: number;
  eventId: string;
  /** How many people per email. */
  perRecipient?: number;
  /** Ceiling on how many of those may be AI-reasoned mutual fits. */
  mutualSlots?: number;
  /** Mutated: candidateId -> times already used this run. Enforces the cap. */
  exposure: Map<string, number>;
  exposureCap: number;
  minScore?: number;
  minBalance?: number;
  cooldownDays?: number;
  /** Times a pair may ever be surfaced before it is retired. */
  maxPairSurfaces?: number;
}

/**
 * How many emails one person may appear in.
 *
 * perRecipient * recipients / poolSize is the average load if exposure were shared
 * perfectly evenly; +2 leaves room for genuinely popular matches without letting
 * three people carry every email.
 */
export function exposureCap(recipients: number, poolSize: number, perRecipient: number): number {
  if (poolSize <= 1) return perRecipient;
  return Math.ceil((perRecipient * recipients) / poolSize) + 2;
}

// FNV-1a. A tiny deterministic string hash: same input, same order, every run,
// with no crypto import and no Math.random (which would make prepare unrepeatable).
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The order recipients are processed in, rotated per event.
 *
 * The exposure cap makes selection order matter: whoever goes first gets the
 * uncapped pick of the pool. Sorting by a per-event hash means that advantage
 * lands on a different person each fortnight instead of always on whoever sorts
 * first alphabetically.
 */
export function recipientOrder(ids: string[], eventId: string): string[] {
  return [...ids].sort((a, b) => stableHash(eventId + a) - stableHash(eventId + b) || a.localeCompare(b));
}

/** True when this pair has been surfaced too recently, or too many times, in either direction. */
function recentlyRecommended(
  a: ClubGuestSignal,
  b: ClubGuestSignal,
  now: number,
  cooldownDays: number,
  maxPairSurfaces: number,
): boolean {
  const last = Math.max(a.recommendedTo?.[b.id] ?? 0, b.recommendedTo?.[a.id] ?? 0);
  if (last && now - last < cooldownDays * DAY) return true;
  const surfaces = Math.max(a.recommendedPairs?.[b.id] ?? 0, b.recommendedPairs?.[a.id] ?? 0);
  return surfaces >= maxPairSurfaces;
}

function has(sig: ClubGuestSignal): boolean {
  return sig.asks.length > 0 || sig.offers.length > 0;
}

/**
 * Pick the people one recipient should meet.
 *
 * Always returns `perRecipient` picks when the pool is big enough (falling back to
 * coverage, then to ignoring the exposure cap), because an email with two names is
 * a worse product than one with two sharp names and three serendipitous ones.
 *
 * SIDE EFFECT: increments `opts.exposure` for each pick, which is how the cap is
 * enforced across the whole run. Callers share one Map for the event.
 */
export function pickFive(
  recipient: ClubGuestSignal,
  pool: ClubGuestSignal[],
  opts: PickOptions,
): ClubPick[] {
  const perRecipient = opts.perRecipient ?? 5;
  const mutualSlots = opts.mutualSlots ?? 4;
  const minScore = opts.minScore ?? 0.8;
  const minBalance = opts.minBalance ?? 0.2;
  const cooldownDays = opts.cooldownDays ?? 120;
  const maxPairSurfaces = opts.maxPairSurfaces ?? 2;
  const { now, eventId, exposure, exposureCap: cap } = opts;

  // Opting out removes a person as a recipient AND as a recommendee, which is the
  // honest reading of "leave me out of this".
  //
  // A person we know nothing about (no asks, no offers, so nothing to quote and
  // nothing to reason from) is excluded as a RECOMMENDEE entirely. Product decision:
  // a name under a generic "New to the group" placeholder is not worth a slot, and
  // an email full of them reads as broken. They still RECEIVE an email (they are a
  // recipient in the caller's pool); they are just never the person recommended.
  // This is what makes the extractiveLine placeholder a true last resort rather than
  // a routine coverage line. `has` is the same predicate the mutual branch uses.
  const eligible = pool.filter((c) => c.id !== recipient.id && !c.optOut && has(c));
  const picks: ClubPick[] = [];
  const taken = new Set<string>();

  const bump = (p: ClubPick) => {
    picks.push(p);
    taken.add(p.id);
    exposure.set(p.id, (exposure.get(p.id) ?? 0) + 1);
  };

  // --- 1. Mutual fits ---
  // Only meaningful when we know something about the recipient; a zero-signal
  // recipient scores 0 against everyone and goes straight to coverage.
  if (has(recipient)) {
    const ranked = eligible
      .filter(has)
      .map((c) => ({ c, s: mutualScore(recipient.asks, recipient.offers, c.asks, c.offers) }))
      .filter((m) => m.s.score >= minScore && m.s.balance >= minBalance)
      .sort((a, b) => b.s.score - a.s.score);

    for (const m of ranked) {
      if (picks.length >= mutualSlots) break;
      if (taken.has(m.c.id)) continue;
      if ((exposure.get(m.c.id) ?? 0) >= cap) continue;
      if (recentlyRecommended(recipient, m.c, now, cooldownDays, maxPairSurfaces)) continue;
      bump({
        id: m.c.id,
        score: m.s.score,
        balance: m.s.balance,
        basis: "mutual",
        anchorText: m.s.aGetsFromB >= m.s.bGetsFromA ? m.c.topOfferText : m.c.topAskText,
      });
    }
  }

  // --- 2. Coverage ---
  // The serendipity slots, and the mechanism by which people who told us nothing
  // still get met. Ordering is deterministic and fairness-first.
  //
  // The tier preference flips by recipient: someone who told us nothing gets the
  // most legible people we have (so their email is still useful), while someone
  // rich in signal absorbs the quiet newcomers (so those newcomers get met).
  const preferRich = !has(recipient);
  const tierRank = (t: SignalTier) => (t === "answers" ? 0 : t === "linkedin" ? 1 : 2);

  const coverageQueue = eligible
    .filter((c) => !taken.has(c.id))
    .filter((c) => !recentlyRecommended(recipient, c, now, cooldownDays, maxPairSurfaces))
    .sort((a, b) => {
      const ea = exposure.get(a.id) ?? 0;
      const eb = exposure.get(b.id) ?? 0;
      if (ea !== eb) return ea - eb;
      if (a.recommendedCount !== b.recommendedCount) return a.recommendedCount - b.recommendedCount;
      const ta = tierRank(a.tier);
      const tb = tierRank(b.tier);
      if (ta !== tb) return preferRich ? ta - tb : tb - ta;
      return stableHash(eventId + recipient.id + a.id) - stableHash(eventId + recipient.id + b.id);
    });

  for (const c of coverageQueue) {
    if (picks.length >= perRecipient) break;
    if ((exposure.get(c.id) ?? 0) >= cap) continue;
    bump({ id: c.id, score: 0, balance: 0, basis: "coverage", anchorText: c.topOfferText ?? c.topAskText });
  }

  // --- 3. Last resort ---
  // The cap is a soft ceiling: better to over-expose one popular person than to
  // send a short email. The cooldown, by contrast, is NOT relaxed here: repeating
  // a pair the recipient already saw is worse than one fewer name.
  if (picks.length < perRecipient) {
    for (const c of coverageQueue) {
      if (picks.length >= perRecipient) break;
      if (taken.has(c.id)) continue;
      bump({ id: c.id, score: 0, balance: 0, basis: "coverage", anchorText: c.topOfferText ?? c.topAskText });
    }
  }

  return picks;
}
