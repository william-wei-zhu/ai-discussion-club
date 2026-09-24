import test from "node:test";
import assert from "node:assert/strict";
import { demoApplicationsCsv, isDemoStatus, isLinkedInUrl, normalizeUrl, validateDemoApplication, type DemoApplication } from "../lib/demo-applications";

const valid = {
  name: " Ada Lovelace ",
  email: "Ada@Example.com",
  description: "An agent that reads research papers and drafts a summary for the team.",
  projectUrl: "github.com/ada/paper-agent",
  linkedinUrl: "https://www.linkedin.com/in/ada",
  company: "",
};

test("a complete application passes and is normalized", () => {
  const r = validateDemoApplication(valid);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.name, "Ada Lovelace");
  assert.equal(r.value.email, "ada@example.com");
  assert.equal(r.value.projectUrl, "https://github.com/ada/paper-agent");
  assert.equal(r.value.company, "");
});

test("each required field is reported when missing", () => {
  const r = validateDemoApplication({});
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(Object.keys(r.errors).sort(), ["description", "email", "linkedinUrl", "name", "projectUrl"]);
  assert.equal(validateDemoApplication(null).ok, false);
});

test("length limits apply", () => {
  const short = validateDemoApplication({ ...valid, description: "Too short." });
  assert.equal(short.ok, false);
  const long = validateDemoApplication({ ...valid, description: "x".repeat(1501) });
  assert.equal(long.ok, false);
  const company = validateDemoApplication({ ...valid, company: "c".repeat(121) });
  assert.equal(company.ok, false);
});

test("LinkedIn must be linkedin.com, not a look-alike", () => {
  assert.equal(isLinkedInUrl("https://www.linkedin.com/in/ada"), true);
  assert.equal(isLinkedInUrl("https://linkedin.com/in/ada"), true);
  assert.equal(isLinkedInUrl("https://linkedin.com.evil.io/in/ada"), false);
  assert.equal(isLinkedInUrl("https://notlinkedin.com/in/ada"), false);
  assert.equal(validateDemoApplication({ ...valid, linkedinUrl: "https://example.com/ada" }).ok, false);
  assert.equal(validateDemoApplication({ ...valid, linkedinUrl: "linkedin.com/in/ada" }).ok, true);
});

test("URLs get a scheme and reject unsafe or malformed input", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("http://example.com/x"), "http://example.com/x");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("not a url"), null);
  assert.equal(normalizeUrl("localhost"), null);
  assert.equal(normalizeUrl(42), null);
});

test("status allowlist", () => {
  assert.equal(isDemoStatus("accepted"), true);
  assert.equal(isDemoStatus("deleted"), false);
});

test("CSV quotes fields and neutralizes formulas", () => {
  const row: DemoApplication = {
    id: "1", status: "new", adminNote: "", createdAt: Date.UTC(2026, 8, 24), updatedAt: 0,
    name: "=HYPERLINK(\"x\")", email: "a@b.co", company: "Acme, Inc.",
    projectUrl: "https://x.co/", linkedinUrl: "https://linkedin.com/in/a", description: "Line one\nline \"two\"",
  };
  const [header, line] = demoApplicationsCsv([row]).split("\r\n");
  assert.match(header, /^Submitted,Status,Name/);
  assert.ok(line.startsWith("2026-09-24T00:00:00.000Z,new,\"'=HYPERLINK(\"\"x\"\")\",a@b.co,\"Acme, Inc.\""));
  assert.ok(demoApplicationsCsv([row]).includes("\"Line one\nline \"\"two\"\"\""));
});
