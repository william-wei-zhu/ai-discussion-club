import { test } from "node:test";
import assert from "node:assert/strict";
import {
  weeklyUnsubscribeToken,
  verifyWeeklyUnsubscribeToken,
  clubUnsubscribeToken,
  verifyClubUnsubscribeToken,
} from "../lib/unsubscribe";

// secret() reads the env at call time, so set it before exercising the helpers.
process.env.UNSUBSCRIBE_SECRET = "test-secret-value";

test("a valid token round-trips back to the uid", () => {
  const token = weeklyUnsubscribeToken("jane-doe");
  assert.ok(token);
  assert.equal(verifyWeeklyUnsubscribeToken(token!), "jane-doe");
});

test("a tampered signature is rejected", () => {
  const token = weeklyUnsubscribeToken("jane-doe")!;
  const tampered = token.slice(0, -1) + (token.at(-1) === "A" ? "B" : "A");
  assert.equal(verifyWeeklyUnsubscribeToken(tampered), null);
});

test("a swapped uid (forged for someone else) is rejected", () => {
  const token = weeklyUnsubscribeToken("jane-doe")!;
  const sig = token.slice(token.lastIndexOf(".") + 1);
  const forged = `${encodeURIComponent("someone-else")}.${sig}`;
  assert.equal(verifyWeeklyUnsubscribeToken(forged), null);
});

test("garbage / empty tokens are rejected", () => {
  assert.equal(verifyWeeklyUnsubscribeToken(""), null);
  assert.equal(verifyWeeklyUnsubscribeToken("nodot"), null);
  assert.equal(verifyWeeklyUnsubscribeToken(".sig"), null);
});

test("uids with special characters survive the round-trip", () => {
  const token = weeklyUnsubscribeToken("josé.q-doe")!;
  assert.equal(verifyWeeklyUnsubscribeToken(token), "josé.q-doe");
});

// --- AI Discussion Club list -------------------------------------------------

test("a club token round-trips back to the Luma user id", () => {
  const token = clubUnsubscribeToken("usr-d9DUpJAnnxzZDdP");
  assert.ok(token);
  assert.equal(verifyClubUnsubscribeToken(token!), "usr-d9DUpJAnnxzZDdP");
});

// The whole point of separate payload prefixes: a token captured from one list
// must not opt the person out of the other. The club list is keyed on Luma ids and
// the weekly digest on member uids, so a cross-replay would also be a cross-product
// data write.
test("a weekly token is rejected by the club verifier, and vice versa", () => {
  const weekly = weeklyUnsubscribeToken("jane-doe")!;
  const club = clubUnsubscribeToken("jane-doe")!;
  assert.notEqual(weekly, club);
  assert.equal(verifyClubUnsubscribeToken(weekly), null);
  assert.equal(verifyWeeklyUnsubscribeToken(club), null);
});

test("a tampered club signature is rejected", () => {
  const token = clubUnsubscribeToken("usr-1")!;
  const tampered = token.slice(0, -1) + (token.at(-1) === "A" ? "B" : "A");
  assert.equal(verifyClubUnsubscribeToken(tampered), null);
});
