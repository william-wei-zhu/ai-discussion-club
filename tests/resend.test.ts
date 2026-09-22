import test from "node:test";
import assert from "node:assert/strict";
import { assertResendSuccess } from "../lib/resend";

test("Resend provider errors are thrown before a send can be stamped complete", () => {
  assert.throws(
    () => assertResendSuccess({ data: null, error: { message: "domain is not verified" } }),
    /domain is not verified/,
  );
});

test("a missing Resend message id is treated as a failed send", () => {
  assert.throws(() => assertResendSuccess({ data: null, error: null }), /message id/);
  assert.equal(assertResendSuccess({ data: { id: "email_123" }, error: null }).data.id, "email_123");
});
