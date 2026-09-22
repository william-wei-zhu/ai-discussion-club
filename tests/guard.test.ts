import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../lib/guard";

// Build a Request with the given headers for clientIp() to parse.
function reqWith(headers: Record<string, string>): Request {
  return new Request("https://superintro.app/api/x", { headers });
}

test("clientIp prefers the platform-trusted x-real-ip", () => {
  const ip = clientIp(reqWith({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4" }));
  assert.equal(ip, "203.0.113.9");
});

test("clientIp ignores a client-spoofed leftmost x-forwarded-for", () => {
  // An attacker prepends a fake IP; we must NOT bucket on it (that would let them
  // rotate the header for a fresh rate-limit bucket every request).
  const ip = clientIp(reqWith({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }));
  assert.notEqual(ip, "6.6.6.6");
  assert.equal(ip, "203.0.113.9"); // the trusted last hop
});

test("clientIp uses x-vercel-forwarded-for over x-forwarded-for", () => {
  const ip = clientIp(reqWith({ "x-vercel-forwarded-for": "198.51.100.7", "x-forwarded-for": "9.9.9.9" }));
  assert.equal(ip, "198.51.100.7");
});

test("clientIp falls back to 'unknown' when no headers present", () => {
  assert.equal(clientIp(reqWith({})), "unknown");
});
