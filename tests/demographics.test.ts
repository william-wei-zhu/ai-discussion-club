import test from "node:test";
import assert from "node:assert/strict";
import { aggregateDemographics, audienceGuestIds, demographicQuestions, DIMENSIONS, employerKey, labelsFromAnswers, type DemographicRow } from "../lib/demographics";
import { AUDIENCE_LINK, decryptToken, DIRECTORY_LINK, directoryUrl, encryptToken, randomUrlToken } from "../lib/directory";

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

test("small buckets fold into smaller groups, and a tiny fold is dropped", () => {
  const s = aggregateDemographics([...rows(12, { ageBand: "25-34" }), ...rows(6, { ageBand: "35-44" }), ...rows(3, { ageBand: "55plus" }), ...rows(2, { ageBand: "45-54" })]);
  const age = s.dimensions.find((d) => d.key === "ageBand")!;
  assert.deepEqual(age.bars.map((b) => [b.id, b.count]), [["25-34", 12], ["35-44", 6], ["smaller", 5]]);
  assert.equal(age.known, 23);
  const s2 = aggregateDemographics([...rows(12, { ageBand: "25-34" }), ...rows(3, { ageBand: "55plus" })]);
  assert.deepEqual(s2.dimensions[0].bars.map((b) => b.id), ["25-34"]);
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

test("audience links have their own path and key", () => {
  const token = randomUrlToken();
  assert.match(directoryUrl(token, AUDIENCE_LINK), new RegExp(`/a/${token}$`));
  assert.match(directoryUrl(token), new RegExp(`/g/${token}$`));
  const enc = encryptToken(token, "secret", AUDIENCE_LINK);
  assert.equal(decryptToken(enc, "secret", AUDIENCE_LINK), token);
  assert.equal(decryptToken(enc, "secret", DIRECTORY_LINK), null);
});
