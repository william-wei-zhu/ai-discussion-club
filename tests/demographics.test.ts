import test from "node:test";
import assert from "node:assert/strict";
import { aggregateDemographics, audienceGuestIds, dedupePeople, personKey, demographicQuestions, DIMENSIONS, employerKey, labelsFromAnswers, type DemographicRow } from "../lib/demographics";

const rows = (n: number, row: DemographicRow): DemographicRow[] => Array.from({ length: n }, () => ({ ...row }));

test("questions cover every dimension with an unknown option", () => {
  const q = demographicQuestions(2026);
  for (const d of DIMENSIONS) {
    assert.equal(q[d.key].type, "choice");
    assert.ok("unknown" in q[d.key].criteria);
    assert.doesNotMatch(q[d.key].instructions, /\{year\}/);
  }
});

test("labels keep only confident, real, non-unknown choices", () => {
  const { labels, confidences } = labelsFromAnswers({
    ageBand: { type: "choice", choice: "25-34", confidence: 0.95, probabilities: {} },
    seniority: { type: "choice", choice: "manager", confidence: 0.4, probabilities: {} },
    role: { type: "choice", choice: "unknown", confidence: 0.99, probabilities: {} },
    sector: { type: "choice", choice: "made-up", confidence: 0.99, probabilities: {} },
  });
  assert.deepEqual(labels, { ageBand: "25-34" });
  assert.equal(confidences.seniority, 0.4);
});

test("too few classified people shows nothing", () => {
  const s = aggregateDemographics([...rows(9, { ageBand: "25-34" }), ...rows(20, {})]);
  assert.equal(s.tooSmall, true);
  assert.equal(s.people, 29);
  assert.deepEqual(s.dimensions, []);
  assert.deepEqual(s.employers, []);
});

test("every category is shown, however small; Other sorts last", () => {
  const s = aggregateDemographics([...rows(12, { ageBand: "25-34" }), ...rows(6, { ageBand: "35-44" }), ...rows(3, { ageBand: "55plus" }), ...rows(2, { ageBand: "45-54" })]);
  const age = s.dimensions.find((d) => d.key === "ageBand")!;
  assert.deepEqual(age.bars.map((b) => [b.id, b.count]), [["25-34", 12], ["35-44", 6], ["45-54", 2], ["55plus", 3]]);
  assert.equal(age.known, 23);
  const roles = aggregateDemographics([...rows(9, { role: "other" }), ...rows(5, { role: "product" }), ...rows(1, { role: "legal" as never })]);
  assert.deepEqual(roles.dimensions[0].bars.map((b) => b.id), ["product", "other"]);
});

test("categorical dimensions sort largest first; ordinal ones keep their order", () => {
  const s = aggregateDemographics([...rows(5, { role: "product", ageBand: "35-44" }), ...rows(9, { role: "engineering", ageBand: "25-34" })]);
  assert.deepEqual(s.dimensions.find((d) => d.key === "role")!.bars.map((b) => b.id), ["engineering", "product"]);
  assert.deepEqual(s.dimensions.find((d) => d.key === "ageBand")!.bars.map((b) => b.id), ["25-34", "35-44"]);
  assert.equal(s.dimensions.find((d) => d.key === "role")!.bars[0].percent, 64);
});

test("dimensions with too few known answers are hidden", () => {
  const s = aggregateDemographics([...rows(12, { ageBand: "25-34" }), ...rows(6, { education: "master" })]);
  assert.deepEqual(s.dimensions.map((d) => d.key), ["ageBand"]);
});

test("employers are named only with 5 or more people, however they are written", () => {
  assert.equal(employerKey("Google LLC"), employerKey("google"));
  assert.equal(employerKey("Booz Allen Hamilton Inc."), "booz allen hamilton");
  const s = aggregateDemographics([
    ...rows(3, { role: "engineering", employer: "Google" }), ...rows(2, { role: "engineering", employer: "Google LLC" }),
    ...rows(4, { role: "engineering", employer: "Tiny Startup" }), ...rows(2, { role: "engineering" }),
  ]);
  assert.deepEqual(s.employers, [{ name: "Google", count: 5 }]);
});

test("event audience counts going guests and hosts, minus opt-outs, check-ins once there are enough", () => {
  const guests = [
    { id: "a", approvalStatus: "approved" }, { id: "b", approvalStatus: "declined" },
    { id: "c", approvalStatus: "invited", isHost: true }, { id: "d", approvalStatus: "approved" },
  ];
  assert.deepEqual(audienceGuestIds(guests, new Set(["d"])), ["a", "c"]);
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, approvalStatus: "approved", checkedInAt: i < 10 ? 1 : null }));
  assert.equal(audienceGuestIds(many, new Set()).length, 10);
  const few = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, approvalStatus: "approved", checkedInAt: i < 3 ? 1 : null }));
  assert.equal(audienceGuestIds(few, new Set()).length, 12);
});

test("one person with two Luma accounts counts once; placeholders and unknowns never merge", () => {
  assert.equal(personKey("https://www.linkedin.com/in/Ada-L/"), "ada-l");
  assert.equal(personKey("https://www.linkedin.com/in/na"), null);
  assert.equal(personKey(undefined), null);
  const rows = dedupePeople([
    { linkedinUrl: "https://www.linkedin.com/in/ada-l", role: "engineering" },
    { linkedinUrl: "https://linkedin.com/in/ADA-L", role: "engineering", ageBand: "25-34" },
    { linkedinUrl: "https://www.linkedin.com/in/test", role: "product" },
    { linkedinUrl: "https://www.linkedin.com/in/test", role: "design" },
    {}, {},
  ]);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { role: "engineering", ageBand: "25-34" });
  assert.equal(rows.some((r) => "linkedinUrl" in r), false);
});
