import test from "node:test";
import assert from "node:assert/strict";
import { CONNECT_WINDOW_MS, connectRecipients, connectTiming, eventEndMs } from "../lib/connect";

const H = 3_600_000;

test("event end uses Luma's end_at, else start + 2h", () => {
  const start = Date.parse("2026-09-27T20:00:00Z");
  assert.equal(eventEndMs({ startAt: start, endAtIso: "2026-09-27T22:30:00Z" }), Date.parse("2026-09-27T22:30:00Z"));
  assert.equal(eventEndMs({ startAt: start }), start + 2 * H);
  // An end before the start (bad data) falls back too.
  assert.equal(eventEndMs({ startAt: start, endAtIso: "2026-09-27T19:00:00Z" }), start + 2 * H);
});

test("connect is due from the end time for 24 hours, then missed", () => {
  const e = { startAt: 0, endAtIso: new Date(10 * H).toISOString() };
  assert.equal(connectTiming(e, 10 * H - 1), "not-yet");
  assert.equal(connectTiming(e, 10 * H), "due");
  assert.equal(connectTiming(e, 10 * H + CONNECT_WINDOW_MS - 1), "due");
  assert.equal(connectTiming(e, 10 * H + CONNECT_WINDOW_MS), "missed");
});

test("connect recipients: going guests and hosts, minus suppressed, one per address", () => {
  const guests = [
    { id: "a", name: "A", email: "a@x.com", approvalStatus: "approved" },
    { id: "b", name: "B", email: "b@x.com", approvalStatus: "declined" },
    { id: "c", name: "C", email: "c@x.com", approvalStatus: "invited", isHost: true },
    { id: "d", name: "D", email: "A@X.com", approvalStatus: "approved" }, // same address as a
    { id: "e", name: "E", email: "e@x.com", approvalStatus: "approved" }, // unsubscribed
    { id: "f", name: "F", email: "", approvalStatus: "approved" },
    { id: "g", name: "G", email: "g@x.com", approvalStatus: "waitlist" },
  ];
  const out = connectRecipients(guests, (id) => id === "e");
  assert.deepEqual(out.map((g) => g.id), ["a", "c"]);
});
