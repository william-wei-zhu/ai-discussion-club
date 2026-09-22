import { test } from "node:test";
import assert from "node:assert/strict";
import { toHref, firstUrl } from "../lib/urls";
import { normalizeUrl } from "../lib/social";

// The linkifier + href builders must never emit a javascript:/data: scheme from
// user-supplied text (this is what keeps post text + social links XSS-safe).

test("toHref forces https:// on bare domains", () => {
  assert.equal(toHref("example.com"), "https://example.com");
  assert.equal(toHref("http://example.com"), "http://example.com");
  assert.equal(toHref("https://example.com"), "https://example.com");
});

test("firstUrl only matches real URLs, not javascript: schemes", () => {
  assert.equal(firstUrl("javascript:alert(1)"), null);
  assert.equal(firstUrl("click here: example.com now"), "https://example.com");
});

test("normalizeUrl neutralizes a javascript: scheme by forcing https://", () => {
  // No dot -> rejected outright.
  assert.equal(normalizeUrl("javascript:alert(1)"), "");
  // Even with a dot, it becomes an inert https URL, never a javascript: href.
  const out = normalizeUrl("javascript:alert(document.domain)");
  assert.ok(out === "" || out.startsWith("https://"), `got: ${out}`);
  assert.ok(!out.startsWith("javascript:"));
});

test("normalizeUrl keeps a valid https url and rejects empty/garbage", () => {
  assert.equal(normalizeUrl("https://calendly.com/me"), "https://calendly.com/me");
  assert.equal(normalizeUrl("  "), "");
  assert.equal(normalizeUrl("nodots"), "");
});
