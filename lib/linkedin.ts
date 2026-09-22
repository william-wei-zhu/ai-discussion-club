// Accept LinkedIn in any shape and normalize to the SINGLE canonical form
// https://www.linkedin.com/in/<handle> (no trailing slash, lowercased). This is
// the one normalizer for LinkedIn URLs across the app (onboarding enrichment,
// the uid handle, profile save, and the claim-dedup key), so the same person's
// URL never yields two different stored strings. LinkedIn handles are
// case-insensitive, so lowercasing is safe and makes dedup case-insensitive.
// Handles: full https/http url, with or without www, bare "linkedin.com/in/x",
// "/in/x", "in/x", trailing slash / query string, and a bare handle ("x").
export function normalizeLinkedInUrl(raw: string): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;

  // full or bare-domain url
  let m = v.match(/linkedin\.com(\/in\/[^\s)?#]+)/i);
  if (m) return ("https://www.linkedin.com" + stripTrailingSlash(m[1])).toLowerCase();

  // "/in/handle" or "in/handle"
  m = v.match(/\/?in\/([^\s/?#)]+)/i);
  if (m) return ("https://www.linkedin.com/in/" + m[1]).toLowerCase();

  // bare handle, e.g. "anmolmansingh" or "steve-kantor-594784"
  if (/^[A-Za-z0-9_%-]{3,}$/.test(v)) return ("https://www.linkedin.com/in/" + v).toLowerCase();

  return null;
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

export function isLinkedInUrl(raw: string): boolean {
  return normalizeLinkedInUrl(raw) !== null;
}

// The OpenID userinfo fields we read from LinkedIn's /v2/userinfo.
export type LinkedInUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

// Build the Firebase custom-token claims for a LinkedIn sign-in, or null when
// LinkedIn gave no usable verified email. verifyRequest rejects any token whose
// email_verified !== true, so minting a token without one produces a
// signed-in-LOOKING session where every API call silently 401s; refusing here
// turns that broken state into an immediate, actionable error. LinkedIn omits
// email_verified rather than denying it, so only an explicit false rejects.
export function buildLinkedInClaims(profile: LinkedInUserInfo): Record<string, unknown> | null {
  const email = profile.email?.trim().toLowerCase();
  if (!email || profile.email_verified === false) return null;
  const claims: Record<string, unknown> = { email, email_verified: true };
  // Carry the LinkedIn name so the completion page can set displayName and
  // onboarding prefills it (parity with Google). LinkedIn OIDC does NOT expose
  // the public profile URL (only this name plus an opaque `sub`), so the URL
  // still comes from the name-based "is this you?" search.
  if (profile.name) claims.name = profile.name;
  return claims;
}

// True only when two inputs resolve to the SAME canonical LinkedIn profile.
// Used to reject an enrichment result whose handle differs from the one the user
// asked for: Exa's content fetch can "nearest-match" a handle it can't crawl to a
// DIFFERENT person's profile (e.g. `robertjordanryan` -> `robryan`), and importing
// that stranger's identity is the wrong-profile bug. A non-`/in/` input (which
// normalizes to null) never matches, so a non-profile Exa URL is also rejected.
export function sameLinkedInHandle(a: string, b: string): boolean {
  const na = normalizeLinkedInUrl(a);
  const nb = normalizeLinkedInUrl(b);
  return na !== null && na === nb;
}
