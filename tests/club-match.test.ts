import { test } from "node:test";
import assert from "node:assert/strict";
import { pickFive, exposureCap, recipientOrder, stableHash, type ClubGuestSignal } from "../lib/club-match";
import type { Intent } from "../lib/types";

// Hand-built 4-dim unit vectors so mutualScore's cosines are predictable.
// TOPIC_A and TOPIC_B are orthogonal, so an A-need only matches an A-offer.
// TOPIC_C is a third orthogonal topic used for "known but non-matching" fillers.
const A = [1, 0, 0, 0];
const B = [0, 1, 0, 0];
const C = [0, 0, 1, 0];

function intent(id: string, text: string, embedding: number[]): Intent {
  return { id, text, embedding, active: true, expiresAt: Date.now() + 86_400_000 };
}

function guest(id: string, opts: Partial<ClubGuestSignal> = {}): ClubGuestSignal {
  return {
    id,
    name: id,
    asks: [],
    offers: [],
    tier: "none",
    recommendedTo: {},
    recommendedPairs: {},
    recommendedCount: 0,
    optOut: false,
    ...opts,
  };
}

/** Someone who needs topic A and offers topic B. */
function needsA(id: string): ClubGuestSignal {
  return guest(id, {
    tier: "answers",
    asks: [intent(`${id}-ask`, "need A", A)],
    offers: [intent(`${id}-offer`, "offer B", B)],
    topAskText: "need A",
    topOfferText: "offer B",
  });
}

/** The complement: needs B, offers A. A perfect two-way fit with needsA. */
function needsB(id: string): ClubGuestSignal {
  return guest(id, {
    tier: "answers",
    asks: [intent(`${id}-ask`, "need B", B)],
    offers: [intent(`${id}-offer`, "offer A", A)],
    topAskText: "need B",
    topOfferText: "offer A",
  });
}

/**
 * A guest we DO know something about, but on an unrelated topic (C), so they never
 * form a mutual fit with needsA/needsB and fall to coverage instead. This is the
 * legitimate serendipity filler now that zero-signal guests are never recommended.
 */
function filler(id: string): ClubGuestSignal {
  return guest(id, {
    tier: "answers",
    asks: [intent(`${id}-ask`, "need C", C)],
    offers: [intent(`${id}-offer`, "offer C", C)],
    topAskText: "need C",
    topOfferText: "offer C",
  });
}

function opts(over: Partial<Parameters<typeof pickFive>[2]> = {}) {
  return {
    now: Date.UTC(2026, 7, 7),
    eventId: "evt-test",
    exposure: new Map<string, number>(),
    exposureCap: 7,
    ...over,
  };
}

test("exposureCap: 99 recipients over a 99-person pool at 5 each is 7", () => {
  assert.equal(exposureCap(99, 99, 5), 7);
  // A tiny pool cannot spread load, so the cap must not choke the selection.
  assert.equal(exposureCap(5, 1, 5), 5);
});

test("a complementary pair is picked as a mutual fit", () => {
  const me = needsA("me");
  const pool = [me, needsB("fit"), filler("quiet1"), filler("quiet2"), filler("quiet3"), filler("quiet4")];
  const picks = pickFive(me, pool, opts());
  assert.equal(picks.length, 5);
  assert.equal(picks[0].id, "fit");
  assert.equal(picks[0].basis, "mutual");
  assert.ok(picks[0].score > 0);
  // The anchor is the candidate's own text, for the extractive why-line.
  assert.ok(picks[0].anchorText);
});

test("always returns exactly five when the pool allows, never the recipient", () => {
  const me = needsA("me");
  const pool = [me, ...Array.from({ length: 20 }, (_, i) => filler(`q${i}`))];
  const picks = pickFive(me, pool, opts());
  assert.equal(picks.length, 5);
  assert.equal(new Set(picks.map((p) => p.id)).size, 5);
  assert.ok(!picks.some((p) => p.id === "me"));
});

test("a tiny pool degrades gracefully instead of throwing", () => {
  const me = needsA("me");
  const pool = [me, filler("a"), filler("b")];
  const picks = pickFive(me, pool, opts());
  assert.equal(picks.length, 2);
});

test("opted-out people are excluded as recommendees", () => {
  const me = needsA("me");
  const pool = [me, needsB("fit"), guest("gone", { optOut: true }), filler("ok1"), filler("ok2")];
  const picks = pickFive(me, pool, opts());
  assert.ok(!picks.some((p) => p.id === "gone"));
});

test("a zero-signal candidate is never recommended", () => {
  // The product decision: someone we know nothing about is not worth a slot under a
  // generic placeholder, so they are excluded as a recommendee entirely.
  const me = needsA("me");
  const pool = [me, filler("known1"), filler("known2"), guest("silent1"), guest("silent2")];
  const picks = pickFive(me, pool, opts());
  assert.ok(!picks.some((p) => p.id === "silent1" || p.id === "silent2"));
  assert.deepEqual(picks.map((p) => p.id).sort(), ["known1", "known2"]);
});

test("a zero-signal recipient still gets recommendations, all from coverage, none of them zero-signal", () => {
  const me = guest("me"); // told us nothing: still a recipient, just not a candidate
  const pool = [me, needsA("rich1"), needsB("rich2"), filler("f1"), filler("f2"), guest("silent")];
  const picks = pickFive(me, pool, opts());
  // Four known candidates exist; the silent one is not eligible, so they get four.
  assert.equal(picks.length, 4);
  assert.ok(picks.every((p) => p.basis === "coverage"));
  assert.ok(!picks.some((p) => p.id === "silent"));
});

test("the cooldown blocks a pair in BOTH directions", () => {
  const recent = Date.UTC(2026, 7, 1); // 6 days before `now`
  // Recorded on the CANDIDATE's doc, not the recipient's: flipping who is the
  // recipient must not resurface the pair.
  const me = needsA("me");
  const fit = needsB("fit");
  fit.recommendedTo = { me: recent };
  const pool = [me, fit, filler("q1"), filler("q2"), filler("q3"), filler("q4"), filler("q5")];
  const picks = pickFive(me, pool, opts());
  assert.ok(!picks.some((p) => p.id === "fit"));
});

test("a pair outside the cooldown is eligible again", () => {
  const old = Date.UTC(2026, 1, 1); // ~6 months before `now`
  const me = needsA("me");
  const fit = needsB("fit");
  fit.recommendedTo = { me: old };
  const pool = [me, fit, filler("q1"), filler("q2"), filler("q3"), filler("q4")];
  const picks = pickFive(me, pool, opts());
  assert.ok(picks.some((p) => p.id === "fit" && p.basis === "mutual"));
});

test("a pair already surfaced twice is retired even after the cooldown", () => {
  const me = needsA("me");
  const fit = needsB("fit");
  fit.recommendedPairs = { me: 2 };
  const pool = [me, fit, filler("q1"), filler("q2"), filler("q3"), filler("q4")];
  const picks = pickFive(me, pool, opts());
  assert.ok(!picks.some((p) => p.id === "fit"));
});

test("the exposure cap holds, and zero-signal guests are never recommended, across a 99-recipient run", () => {
  // The failure this prevents: the three best-embedded attendees appearing in all
  // 99 emails, everyone comparing notes at the event, and the feature reading as
  // spam. Simulate the real prepare loop and assert nobody exceeds the cap.
  const pool: ClubGuestSignal[] = [];
  for (let i = 0; i < 99; i++) {
    // A third are strong A-needers, a third strong B-needers, a third silent:
    // roughly the measured 38 answers / 27 zero-signal shape of a real event.
    pool.push(i % 3 === 0 ? needsA(`a${i}`) : i % 3 === 1 ? needsB(`b${i}`) : guest(`q${i}`));
  }
  // The cap spreads load over the RECOMMENDABLE people only, since the silent third
  // are never picked. This mirrors prepareEvent, which bases the cap on the same set.
  const recommendable = pool.filter((p) => p.asks.length > 0 || p.offers.length > 0).length;
  const exposure = new Map<string, number>();
  const cap = exposureCap(99, recommendable, 5);
  const order = recipientOrder(pool.map((p) => p.id), "evt-test");
  const byId = new Map(pool.map((p) => [p.id, p]));

  let total = 0;
  for (const id of order) {
    // Every one of the 99 still RECEIVES an email (silent people included as
    // recipients); they just draw only from the recommendable pool.
    const picks = pickFive(byId.get(id)!, pool, opts({ exposure, exposureCap: cap }));
    assert.equal(picks.length, 5, `${id} got ${picks.length} picks`);
    total += picks.length;
  }
  assert.equal(total, 99 * 5);
  const worst = Math.max(...exposure.values());
  assert.ok(worst <= cap, `worst exposure ${worst} exceeded cap ${cap}`);
  // Only the known people are ever recommended; no silent "q" guest is surfaced.
  assert.equal(exposure.size, recommendable);
  assert.ok(![...exposure.keys()].some((k) => k.startsWith("q")), "a zero-signal guest was recommended");
});

test("selection is deterministic: same inputs, same output", () => {
  const build = () => {
    const pool = Array.from({ length: 12 }, (_, i) => (i % 2 ? needsA(`a${i}`) : needsB(`b${i}`)));
    return pool;
  };
  const p1 = build();
  const p2 = build();
  const r1 = pickFive(p1[0], p1, opts());
  const r2 = pickFive(p2[0], p2, opts());
  assert.deepEqual(
    r1.map((p) => p.id),
    r2.map((p) => p.id),
  );
});

test("recipientOrder is a stable permutation that varies by event", () => {
  const ids = Array.from({ length: 30 }, (_, i) => `u${i}`);
  const a = recipientOrder(ids, "evt-1");
  const b = recipientOrder(ids, "evt-2");
  assert.equal(a.length, 30);
  assert.deepEqual([...a].sort(), [...ids].sort()); // a permutation, nobody dropped
  assert.deepEqual(a, recipientOrder(ids, "evt-1")); // stable
  assert.notDeepEqual(a, b); // rotated per event, so the same person isn't always first
});

test("stableHash is deterministic and spreads", () => {
  assert.equal(stableHash("abc"), stableHash("abc"));
  assert.notEqual(stableHash("abc"), stableHash("abd"));
});
