import test from "node:test";
import assert from "node:assert/strict";
import { calendarSyncGate } from "../lib/cron-sync";

test("calendar sync fails closed when the cron secret is absent or wrong", () => {
  assert.equal(calendarSyncGate({ authorization: "", secret: "", jobsEnabled: true, lumaConfigured: true }), "unauthorized");
  assert.equal(calendarSyncGate({ authorization: "Bearer wrong", secret: "right", jobsEnabled: true, lumaConfigured: true }), "unauthorized");
});

test("calendar sync remains inert until jobs and Luma are configured", () => {
  assert.equal(calendarSyncGate({ authorization: "Bearer secret", secret: "secret", jobsEnabled: false, lumaConfigured: true }), "jobs-disabled");
  assert.equal(calendarSyncGate({ authorization: "Bearer secret", secret: "secret", jobsEnabled: true, lumaConfigured: false }), "luma-not-configured");
});

test("calendar sync runs only with every gate satisfied", () => {
  assert.equal(calendarSyncGate({ authorization: "Bearer secret", secret: "secret", jobsEnabled: true, lumaConfigured: true }), "ready");
});
