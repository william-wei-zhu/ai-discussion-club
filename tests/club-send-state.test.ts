import { test } from "node:test";
import assert from "node:assert/strict";
import { willSendAutomatically, describeSendState } from "../lib/send-state";
import { filterSendablePeople } from "../lib/club";
import type { ClubEvent } from "../lib/types";

// Minimal event shapes for the pure send-state helpers. Only the fields the helpers
// read matter, so we cast partials rather than building a whole ClubEvent.
const ev = (over: Partial<ClubEvent>): ClubEvent => over as ClubEvent;

test("willSendAutomatically: armed and not cancelled is the only 'on'", () => {
  assert.equal(willSendAutomatically(ev({ autoSend: true })), true);
  assert.equal(willSendAutomatically(ev({ autoSend: true, cancelled: false })), true);
  // A pause (cancelled) overrides the arm, even though autoSend is still true.
  assert.equal(willSendAutomatically(ev({ autoSend: true, cancelled: true })), false);
  assert.equal(willSendAutomatically(ev({ autoSend: false })), false);
  assert.equal(willSendAutomatically(ev({})), false);
});

test("describeSendState: cancelled reads 'stopped' even when armed", () => {
  // The exact bug this fix targets: cancelled + autoSend must never read as 'on'.
  const s = describeSendState(ev({ autoSend: true, cancelled: true, cancelledBy: "safety-stop", cancelledAt: 123 }));
  assert.equal(s.kind, "stopped");
  assert.equal(s.by, "safety-stop");
  assert.equal(s.at, 123);
});

test("describeSendState: armed and not cancelled is 'scheduled'", () => {
  assert.equal(describeSendState(ev({ autoSend: true })).kind, "scheduled");
});

test("describeSendState: neither armed nor cancelled is 'off'", () => {
  assert.equal(describeSendState(ev({})).kind, "off");
  assert.equal(describeSendState(ev({ autoSend: false, cancelled: false })).kind, "off");
});

test("describeSendState: cancelled but never armed is still 'stopped'", () => {
  assert.equal(describeSendState(ev({ cancelled: true })).kind, "stopped");
});

test("describeSendState: send progress beats every switch", () => {
  // Sending in progress and fully sent both win over cancelled/armed.
  assert.equal(
    describeSendState(ev({ cancelled: true, send: { startedAt: 1, sent: 5, skipped: 0, failed: 0 } })).kind,
    "sending",
  );
  assert.equal(
    describeSendState(ev({ autoSend: true, send: { startedAt: 1, completedAt: 2, sent: 100, skipped: 1, failed: 0 } }))
      .kind,
    "sent",
  );
  // Completed wins even if a later pause was set.
  assert.equal(
    describeSendState(
      ev({ cancelled: true, send: { startedAt: 1, completedAt: 2, sent: 100, skipped: 0, failed: 0 } }),
    ).kind,
    "sent",
  );
});

test("send-time filtering removes people who opted out or left the event", () => {
  const people = [
    { id: "still-in", name: "Still In" },
    { id: "opted-out", name: "Opted Out" },
    { id: "declined", name: "Declined" },
  ];
  assert.deepEqual(
    filterSendablePeople(people, new Set(["still-in", "opted-out"]), new Set(["still-in"])),
    [{ id: "still-in", name: "Still In" }],
  );
});
