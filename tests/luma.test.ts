import { test } from "node:test";
import assert from "node:assert/strict";
import {
  unwrapGuest,
  guestKey,
  guestEmail,
  guestName,
  isApproved,
  personEmail,
  personName,
  linkedinFromAnswers,
  isProfileUrl,
  substantiveAnswers,
  eventStartMs,
  hoursUntil,
  formatEventStart,
  hostKey,
  hostName,
  hostEmail,
} from "../lib/luma";

// Pure helpers only: no network, no key needed. The transport (lumaGet/pageAll)
// is exercised against the live API by scripts/sync-club.ts.

test("unwrapGuest handles both the wrapped and the flat envelope", () => {
  const flat = { user_api_id: "usr-1", name: "Ada" };
  assert.deepEqual(unwrapGuest(flat), flat);
  assert.deepEqual(unwrapGuest({ guest: flat }), flat);
  assert.deepEqual(unwrapGuest(null), {});
});

test("guestKey is the stable per-person id, not the per-event one", () => {
  assert.equal(guestKey({ api_id: "gst-abc", user_api_id: "usr-xyz" }), "usr-xyz");
  // A guest row with no user is unusable as a contact and must not silently
  // fall back to the per-event gst- id (that would create a new contact per event).
  assert.equal(guestKey({ api_id: "gst-abc" }), null);
});

test("guest name and email fall back to the user_* fields and lowercase", () => {
  assert.equal(guestEmail({ user_email: "Ada@Example.COM" }), "ada@example.com");
  assert.equal(guestEmail({ email: " A@b.co ", user_email: "z@z.co" }), "a@b.co");
  assert.equal(guestEmail({}), "");
  assert.equal(guestName({ user_name: "Ada Lovelace" }), "Ada Lovelace");
  assert.equal(guestName({ name: "Ada", user_name: "Ignored" }), "Ada");
});

test("isApproved is strict: invited and declined are not confirmed", () => {
  assert.equal(isApproved({ approval_status: "approved" }), true);
  assert.equal(isApproved({ approval_status: "invited" }), false);
  assert.equal(isApproved({ approval_status: "declined" }), false);
  assert.equal(isApproved({}), false);
});

test("calendar-person name and email read through the embedded user", () => {
  const p = { email: "Ros@Example.com", user: { name: " Rosalind ", email: "other@x.co" } };
  assert.equal(personEmail(p), "ros@example.com");
  assert.equal(personName(p), "Rosalind");
  assert.equal(personEmail({ user: { email: "Only@User.com" } }), "only@user.com");
});

test("linkedinFromAnswers finds the answer by Luma question_type", () => {
  const g = {
    registration_answers: [
      { label: "What do you hope to build?", answer: "an agent" },
      { question_type: "linkedin", answer: "/in/ada-lovelace" },
    ],
  };
  assert.equal(linkedinFromAnswers(g), "https://www.linkedin.com/in/ada-lovelace");
});

test("linkedinFromAnswers also matches on a label mentioning LinkedIn", () => {
  const g = {
    registration_answers: [
      { label: "Your LinkedIn profile", value: "https://www.linkedin.com/in/Grace-Hopper/" },
    ],
  };
  assert.equal(linkedinFromAnswers(g), "https://www.linkedin.com/in/grace-hopper");
});

test("linkedinFromAnswers returns null when there is no LinkedIn question", () => {
  assert.equal(linkedinFromAnswers({ registration_answers: [{ label: "Goals", answer: "x" }] }), null);
  assert.equal(linkedinFromAnswers({ registration_answers: [] }), null);
  assert.equal(linkedinFromAnswers({}), null);
  // Present but blank (the common real case) must not yield a bogus URL.
  assert.equal(linkedinFromAnswers({ registration_answers: [{ question_type: "linkedin", answer: "" }] }), null);
});

test("isProfileUrl only accepts a real /in/ profile", () => {
  assert.equal(isProfileUrl("https://www.linkedin.com/in/ada"), true);
  assert.equal(isProfileUrl("https://www.linkedin.com/company/acme"), false);
  assert.equal(isProfileUrl(null), false);
  assert.equal(isProfileUrl(undefined), false);
});

test("substantiveAnswers drops empty, short, LinkedIn and phone answers", () => {
  const g = {
    registration_answers: [
      { question_id: "q1", label: "What goals are you working toward?", answer: "Scaling my investment research process with agents." },
      { question_id: "q2", label: "What are you great at?", answer: "" },
      { question_id: "q3", label: "Anything else?", answer: "nope" },
      { question_id: "q4", label: "Your LinkedIn", answer: "/in/ada" },
      { question_id: "q5", label: "Phone number", answer: "+1 555 000 1111 ext 42" },
    ],
  };
  const out = substantiveAnswers(g);
  assert.equal(out.length, 1);
  assert.equal(out[0].questionId, "q1");
  assert.match(out[0].answer, /investment research/);
});

test("substantiveAnswers reads the `value` field Luma actually sends", () => {
  // The live API returns both `answer` and `value`; older rows only have `value`.
  const g = { registration_answers: [{ label: "Goals", value: "Looking for a technical cofounder in DC." }] };
  assert.equal(substantiveAnswers(g).length, 1);
});

test("substantiveAnswers is empty for a guest who answered nothing", () => {
  assert.deepEqual(substantiveAnswers({}), []);
  assert.deepEqual(substantiveAnswers({ registration_answers: [] }), []);
});

// Regression: the live API returns NON-STRING answer values, which crashed the
// first full backfill on event 9 of 18. A "terms" waiver checkbox answers boolean
// `true`, and a skipped LinkedIn question answers null.
test("substantiveAnswers survives non-string answer values", () => {
  const g = {
    registration_answers: [
      { label: "Terms and Conditions", question_type: "terms", answer: true, value: true },
      { label: "What is your LinkedIn profile?", question_type: "linkedin", answer: null, value: null },
      { label: "Attendee count", question_type: "number", answer: 3 },
      { label: "Notes", question_type: "long-text", answer: { nested: "object" } },
    ],
  } as unknown as Parameters<typeof substantiveAnswers>[0];
  // Nothing here is prose a human wrote about themselves, so nothing survives, and
  // crucially nothing throws and no "true"/"[object Object]" reaches an embedding.
  assert.deepEqual(substantiveAnswers(g), []);
});

test("substantiveAnswers joins a multi-select array answer", () => {
  const g = {
    registration_answers: [
      { label: "Which topics interest you?", question_type: "multi-select", answer: ["evals", "agents", "retrieval"] },
    ],
  } as unknown as Parameters<typeof substantiveAnswers>[0];
  assert.equal(substantiveAnswers(g)[0].answer, "evals, agents, retrieval");
});

test("eventStartMs parses the real ISO strings and is NaN-safe", () => {
  assert.equal(eventStartMs({ start_at: "2026-08-08T19:00:00.000Z" }), Date.UTC(2026, 7, 8, 19));
  assert.equal(eventStartMs({ start_at: "2026-08-29T14:30:00.000Z" }), Date.UTC(2026, 7, 29, 14, 30));
  assert.equal(eventStartMs({ start_at: "not a date" }), 0);
  assert.equal(eventStartMs({}), 0);
});

test("hoursUntil drives the prepare/send windows", () => {
  const start = Date.UTC(2026, 7, 8, 19);
  const hour = 3_600_000;
  assert.equal(hoursUntil(start, start - 47 * hour), 47); // prepare window (24 < h <= 48)
  assert.equal(hoursUntil(start, start - 23 * hour), 23); // send window (0 < h <= 24)
  assert.ok(hoursUntil(start, start + hour) < 0); // already started
});

test("formatEventStart renders in the event's own timezone", () => {
  const s = formatEventStart({ start_at: "2026-08-08T19:00:00.000Z", timezone: "America/New_York" });
  // 19:00 UTC on Aug 8 2026 is 3:00 PM EDT, a Saturday.
  assert.match(s, /Saturday/);
  assert.match(s, /Aug 8/);
  assert.match(s, /3:00/);
  // An unknown zone must fall back rather than throw inside an email build.
  assert.ok(formatEventStart({ start_at: "2026-08-08T19:00:00.000Z", timezone: "Mars/Olympus" }).length > 0);
  assert.equal(formatEventStart({}), "");
});

// Regression: hosts are a SEPARATE Luma concept from guests. /event/get-guests files
// an organizer as "invited", so an approved-only filter silently drops the people
// running the event. This cost Richard Ling and Florian Alvarez their Builder Nights
// emails: both are hosts, and both read as "never confirmed".
test("host name falls back sensibly when Luma leaves it null", () => {
  assert.equal(hostName({ name: "Richard Ling" }), "Richard Ling");
  assert.equal(hostName({ name: null, first_name: "Florian", last_name: "Alvarez" }), "Florian Alvarez");
  // A real observed row: name, first_name and last_name all null, only an email.
  assert.equal(hostName({ name: null, email: "florianalvarez1@gmail.com" }), "florianalvarez1");
  assert.equal(hostName({}), "");
});

test("host key and email normalise like guest ones", () => {
  assert.equal(hostKey({ api_id: "usr-1", id: "usr-1" }), "usr-1");
  assert.equal(hostKey({ id: "usr-2" }), "usr-2");
  assert.equal(hostKey({}), null);
  assert.equal(hostEmail({ email: " Rich@Example.COM " }), "rich@example.com");
});
