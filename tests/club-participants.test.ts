import { test } from "node:test";
import assert from "node:assert/strict";
import { buildParticipantRows } from "../lib/club";
import type { ClubGuest, ClubContact } from "../lib/types";

// Minimal shapes for the pure participant-row builder. Only the fields it reads
// matter, so we cast partials rather than building whole docs.
type ContactFields = Pick<ClubContact, "name" | "headline" | "linkedinUrl" | "linkedinConfidence">;

const guest = (over: Partial<ClubGuest>): ClubGuest =>
  ({ id: "g", name: "", email: "", approvalStatus: "approved", answers: [], hasAnswers: false, syncedAt: 0, ...over }) as ClubGuest;

const answer = (text: string) => ({ questionId: "q", label: "l", answer: text });

const contacts = (m: Record<string, ContactFields>) => new Map(Object.entries(m));

test("background: headline wins over registration answers", () => {
  const rows = buildParticipantRows(
    [guest({ id: "a", name: "Ann", answers: [answer("building a fintech startup")] })],
    contacts({ a: { name: "Ann", headline: "Founder at a fintech" } as ContactFields }),
  );
  assert.equal(rows[0].background, "Founder at a fintech");
});

test("background: falls back to answers when there is no headline, joined with a separator", () => {
  const rows = buildParticipantRows(
    [guest({ id: "a", name: "Ann", answers: [answer("growing my design agency"), answer("great at brand strategy")] })],
    contacts({ a: { name: "Ann" } as ContactFields }),
  );
  assert.equal(rows[0].background, "growing my design agency · great at brand strategy");
});

test("background: empty/whitespace answers are dropped, and is blank when nothing is known", () => {
  const rows = buildParticipantRows(
    [
      guest({ id: "a", name: "Ann", answers: [answer("  "), answer("real answer here")] }),
      guest({ id: "b", name: "Bo", answers: [] }),
    ],
    contacts({}),
  );
  const byName = Object.fromEntries(rows.map((r) => [r.name, r.background]));
  assert.equal(byName["Ann"], "real answer here");
  assert.equal(byName["Bo"], "");
});

test("LinkedIn URL is emitted only for a trusted profile (given/high), blank for low", () => {
  const rows = buildParticipantRows(
    [
      guest({ id: "a", name: "Ann" }),
      guest({ id: "b", name: "Bo" }),
      guest({ id: "c", name: "Cy" }),
    ],
    contacts({
      a: { linkedinUrl: "https://linkedin.com/in/ann", linkedinConfidence: "given" } as ContactFields,
      b: { linkedinUrl: "https://linkedin.com/in/bo", linkedinConfidence: "high" } as ContactFields,
      c: { linkedinUrl: "https://linkedin.com/in/cy", linkedinConfidence: "low" } as ContactFields,
    }),
  );
  const byName = Object.fromEntries(rows.map((r) => [r.name, r.linkedin]));
  assert.equal(byName["Ann"], "https://linkedin.com/in/ann");
  assert.equal(byName["Bo"], "https://linkedin.com/in/bo");
  assert.equal(byName["Cy"], "");
});

test("hosts are included even when their approvalStatus is not 'approved'", () => {
  const rows = buildParticipantRows(
    [guest({ id: "h", name: "Host", approvalStatus: "invited", isHost: true })],
    contacts({}),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Host");
});

test("non-approved, non-host registrants are excluded", () => {
  const rows = buildParticipantRows(
    [
      guest({ id: "a", name: "Ann", approvalStatus: "approved" }),
      guest({ id: "d", name: "Dan", approvalStatus: "declined" }),
      guest({ id: "i", name: "Ivy", approvalStatus: "invited" }),
    ],
    contacts({}),
  );
  assert.deepEqual(
    rows.map((r) => r.name),
    ["Ann"],
  );
});

test("name falls back to the guest's own name when there is no contact, sorted case-insensitively", () => {
  const rows = buildParticipantRows(
    [
      guest({ id: "z", name: "zoe" }),
      guest({ id: "a", name: "Al" }),
      guest({ id: "m", name: "mia" }),
    ],
    contacts({ a: { name: "Alicia" } as ContactFields }),
  );
  assert.deepEqual(
    rows.map((r) => r.name),
    ["Alicia", "mia", "zoe"],
  );
});
