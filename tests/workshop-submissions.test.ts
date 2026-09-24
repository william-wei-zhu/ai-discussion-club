import test from "node:test";
import assert from "node:assert/strict";
import { displayHost, validateWorkshopSubmission } from "../lib/workshop-submissions";

const workshop = "build-your-first-website-with-claude";

test("a valid submission is normalized", () => {
  const r = validateWorkshopSubmission({ workshop, name: "  Ada \n Lovelace ", url: "my-app.vercel.app" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.name, "Ada Lovelace");
  assert.equal(r.value.url, "https://my-app.vercel.app/");
});

test("unsafe or unusable links are rejected", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "localhost", "", "two words.com"]) {
    const r = validateWorkshopSubmission({ workshop, name: "Ada", url });
    assert.equal(r.ok, false, url);
    if (!r.ok) assert.ok(r.errors.url, url);
  }
});

test("a blank or overlong name is rejected", () => {
  for (const name of ["", "   ", "x".repeat(81)]) {
    const r = validateWorkshopSubmission({ workshop, name, url: "https://a.dev" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.name);
  }
});

test("an unknown workshop is rejected", () => {
  const r = validateWorkshopSubmission({ workshop: "nope", name: "Ada", url: "https://a.dev" });
  assert.equal(r.ok, false);
});

test("displayHost drops www", () => {
  assert.equal(displayHost("https://www.example.com/x"), "example.com");
});
