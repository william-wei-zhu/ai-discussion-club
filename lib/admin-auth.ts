import { timingSafeEqual } from "crypto";
import { verifyRequest } from "@/lib/firebase-admin";

// Gate for the hidden admin console (/admin + /api/admin/*). Access requires BOTH:
//   1) the shared admin password, sent in the `x-admin-password` header, AND
//   2) a signed-in Google (Firebase) identity whose verified email is on the
//      admin allowlist, sent as the usual `Authorization: Bearer <idToken>`.
// Either factor alone is insufficient, so a leaked password can't be used without
// also controlling an allowlisted Google account, and a normal member's login
// can't reach admin routes without the password.

// Password: env var with NO functional default. If ADMIN_PASSWORD is unset the
// console fails closed (requireAdmin returns false), so a forgotten prod config
// can never leave the admin surface guarded by only the Google allowlist. Set
// ADMIN_PASSWORD in every environment (including local .env.local).
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// Constant-time password comparison (avoids a timing side channel on the header).
function passwordMatches(supplied: string | null): boolean {
  if (!ADMIN_PASSWORD || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ADMIN_EMAILS = ["wzhu1997@gmail.com"];

export function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// True only when the request carries the exact admin password AND a verified
// Firebase token whose email is on the allowlist. Fails closed on every branch
// (empty password, missing/invalid token, non-admin email).
export async function requireAdmin(req: Request): Promise<boolean> {
  if (!passwordMatches(req.headers.get("x-admin-password"))) return false;
  const auth = await verifyRequest(req);
  return isAdminEmail(auth?.email);
}
