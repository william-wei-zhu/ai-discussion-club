import { test } from "node:test";
import assert from "node:assert/strict";
import { isCacheFresh } from "../lib/club";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 6, 30);

// The Exa enrichment cache is keyed per CONTACT, not per event, so a member who
// signs up for event after event is looked up once. These assertions pin the reuse
// window: within it we must never pay again, past it we refresh once.
test("a cache inside the window is reused", () => {
  assert.equal(isCacheFresh(NOW - 1 * DAY, NOW), true);
  assert.equal(isCacheFresh(NOW - 179 * DAY, NOW), true);
  // The stated guarantee: six months of re-signups cost nothing.
  assert.equal(isCacheFresh(NOW - 180 * DAY + 1000, NOW), true);
});

test("a cache past the window is refetched", () => {
  assert.equal(isCacheFresh(NOW - 180 * DAY, NOW), false);
  assert.equal(isCacheFresh(NOW - 400 * DAY, NOW), false);
});

test("a missing or future timestamp is never treated as fresh", () => {
  assert.equal(isCacheFresh(undefined, NOW), false);
  assert.equal(isCacheFresh(0, NOW), false);
  // A clock problem must not pin a cache as fresh forever.
  assert.equal(isCacheFresh(NOW + 10 * DAY, NOW), false);
});

test("the window is configurable", () => {
  assert.equal(isCacheFresh(NOW - 40 * DAY, NOW, 30), false);
  assert.equal(isCacheFresh(NOW - 20 * DAY, NOW, 30), true);
});
