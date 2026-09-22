import { createHmac, timingSafeEqual } from "crypto";

// One-click unsubscribe tokens for transactional-list emails (currently the
// weekly digest). The token is an HMAC of the recipient's uid, so a link can't be
// forged to unsubscribe someone else, and no login is required to honor it
// (RFC 8058 one-click, which Gmail/Yahoo bulk-sender rules expect).

// Signing secret: a dedicated UNSUBSCRIBE_SECRET if set, else CRON_SECRET (both
// are server-only and present wherever the digest is generated). Returns "" when
// neither is configured, in which case the caller omits the header/link entirely.
function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? "";
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

// Each email category signs with its OWN payload prefix, so a token captured from
// one category cannot be replayed against another: a weekly-digest link can never
// opt someone out of the club list, or vice versa. Tokens are otherwise identical
// in shape, so both categories share one signer and one verifier.
function issue(prefix: string, subject: string): string | null {
  const key = secret();
  if (!key || !subject) return null;
  return `${encodeURIComponent(subject)}.${sign(`${prefix}:${subject}`, key)}`;
}

function check(prefix: string, token: string): string | null {
  const key = secret();
  if (!key || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const subject = decodeURIComponent(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  const expected = sign(`${prefix}:${subject}`, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return subject;
}

// A token authorizing the weekly-digest unsubscribe for `uid`, or null when no
// signing secret is configured.
export function weeklyUnsubscribeToken(uid: string): string | null {
  return issue("weekly", uid);
}

// Verify a weekly-unsubscribe token, returning the uid it authorizes, or null if
// it's malformed, unsigned, or the signature doesn't match (constant-time).
export function verifyWeeklyUnsubscribeToken(token: string): string | null {
  return check("weekly", token);
}

// The AI Discussion Club list. Subject is the Luma user_api_id, not a SuperIntro
// uid, and it flips clubContacts.emailOptOut rather than a member's notifyWeekly.
export function clubUnsubscribeToken(lumaUserId: string): string | null {
  return issue("club", lumaUserId);
}

export function verifyClubUnsubscribeToken(token: string): string | null {
  return check("club", token);
}
