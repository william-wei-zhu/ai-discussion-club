import test from "node:test";
import assert from "node:assert/strict";
import { consentPatch, normalizeEmail, preferenceHash, preferenceToken, requestOriginAllowed, validPreferenceToken } from "../lib/preferences";

test("preference tokens are URL-safe and hashed", () => {
  const token = preferenceToken();
  assert.equal(validPreferenceToken(token), true);
  assert.match(preferenceHash(token), /^[a-f0-9]{64}$/);
  assert.equal(validPreferenceToken("bad"), false);
});

test("email normalization is canonical and rejects malformed input", () => {
  assert.equal(normalizeEmail(" Member@Example.COM "), "member@example.com");
  assert.equal(normalizeEmail("missing-at.example.com"), null);
  assert.equal(normalizeEmail(null), null);
});

test("consent accepts only an explicit boolean and records verified source", () => {
  assert.equal(consentPatch("true"), null);
  assert.equal(consentPatch(undefined), null);
  assert.deepEqual({ ...consentPatch(true), updatedAt: 0 }, { enabled: true, updatedAt: 0, source: "email-verified" });
});

test("origin validation is exact", () => {
  const previous = process.env.APP_ALLOWED_ORIGINS;
  process.env.APP_ALLOWED_ORIGINS = "https://club.example,https://www.club.example";
  assert.equal(requestOriginAllowed(new Request("https://club.example/api", { headers: { origin: "https://club.example" } })), true);
  assert.equal(requestOriginAllowed(new Request("https://club.example/api", { headers: { origin: "https://club.example.attacker.test" } })), false);
  assert.equal(requestOriginAllowed(new Request("https://club.example/api")), false);
  if (previous === undefined) delete process.env.APP_ALLOWED_ORIGINS; else process.env.APP_ALLOWED_ORIGINS = previous;
});
