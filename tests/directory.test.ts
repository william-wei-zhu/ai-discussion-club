import test from "node:test";
import assert from "node:assert/strict";
import { hashToken, isDirectoryToken, randomUrlToken, toDirectoryCard, trustedLinkedIn, trustedPhotoUrl, visibleDirectoryMember } from "../lib/directory";

test("directory tokens are random URL-safe values stored by hash", () => {
  const a = randomUrlToken();
  const b = randomUrlToken();
  assert.equal(isDirectoryToken(a), true);
  assert.notEqual(a, b);
  assert.match(hashToken(a), /^[a-f0-9]{64}$/);
  assert.notEqual(hashToken(a), a);
  assert.equal(isDirectoryToken("short"), false);
});

test("directory lists going guests and hosts unless they opted out", () => {
  assert.equal(visibleDirectoryMember({ approvalStatus: "approved" }), true);
  assert.equal(visibleDirectoryMember({ approvalStatus: "invited", isHost: true }), true);
  assert.equal(visibleDirectoryMember({ optedOut: true, approvalStatus: "approved" }), false);
  assert.equal(visibleDirectoryMember({ optedOut: true, approvalStatus: "host", isHost: true }), false);
  assert.equal(visibleDirectoryMember({ approvalStatus: "invited" }), false);
  assert.equal(visibleDirectoryMember({ approvalStatus: "declined" }), false);
});

test("directory allowlists profile links and photos", () => {
  assert.equal(trustedLinkedIn("linkedin.com/in/Ada-L", "given"), "https://www.linkedin.com/in/ada-l");
  assert.equal(trustedLinkedIn("https://linkedin.com/in/ada-l", "low"), undefined);
  assert.equal(trustedPhotoUrl("https://images.lumacdn.com/avatar.png"), "https://images.lumacdn.com/avatar.png");
  assert.equal(trustedPhotoUrl("http://images.lumacdn.com/avatar.png"), undefined);
  assert.equal(trustedPhotoUrl("https://example.com/avatar.png"), undefined);
});

test("directory DTO exposes only public card fields", () => {
  const card = toDirectoryCard({
    guest: { name: "Ada", email: "private@example.com", answers: ["secret"], approvalStatus: "approved" },
    contact: { name: "Ada Lovelace", headline: "Builds careful systems", email: "private@example.com", linkedinUrl: "linkedin.com/in/ada-l", linkedinConfidence: "high", avatarUrl: "/api/img/private" },
  });
  assert.deepEqual(card, { name: "Ada Lovelace", background: "Builds careful systems", linkedinUrl: "https://www.linkedin.com/in/ada-l", isHost: false });
  assert.equal("email" in (card ?? {}), false);
  assert.equal("answers" in (card ?? {}), false);
});
