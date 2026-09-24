// Pure profile rules shared by enrichment, the directory, emails, admin and
// /preferences. No I/O here, so every precedence decision is unit-tested.
import { normalizeLinkedInUrl, sameLinkedInHandle } from './linkedin';

type LinkedInFields = { linkedinUrl?: unknown; linkedinConfidence?: unknown; linkedinSource?: unknown };
type PhotoFields = LinkedInFields & { photoUrl?: unknown; linkedinPhoto?: unknown; avatarUrl?: unknown };

/**
 * A LinkedIn URL typed by a person. Stricter than normalizeLinkedInUrl, which also
 * accepts a bare word ("hello") as a handle: a human-entered value must name an
 * actual /in/ profile so a typo can never become someone else's link.
 */
export function parseLinkedInInput(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v || v.length > 300 || !/linkedin\.com\/in\/[^\s/?#]+/i.test(v)) return null;
  return normalizeLinkedInUrl(v);
}

/** The one trust gate: only a given or high-confidence URL is shown, emailed or read. */
export function isTrustedLinkedIn(c: LinkedInFields): boolean {
  return typeof c.linkedinUrl === 'string' && !!c.linkedinUrl && (c.linkedinConfidence === 'given' || c.linkedinConfidence === 'high');
}

export function trustedLinkedInUrl(c: LinkedInFields): string | undefined {
  return isTrustedLinkedIn(c) ? String(c.linkedinUrl) : undefined;
}

/** Set by the person or an admin: registration answers and enrichment never overwrite it. */
export function isLinkedInLocked(c: LinkedInFields): boolean {
  return c.linkedinConfidence === 'given' && (c.linkedinSource === 'self' || c.linkedinSource === 'admin');
}

/** Whether a Luma registration answer may replace the stored URL. */
export function shouldPromoteRegistrationUrl(c: LinkedInFields | undefined, fromAnswers: string | null | undefined): boolean {
  if (!fromAnswers) return false;
  if (c && isLinkedInLocked(c)) return false;
  return c?.linkedinUrl !== fromAnswers;
}

/** An Exa cache entry only describes the contact while it is for the SAME profile they have now. */
export function cacheMatchesProfile(cacheUrl: unknown, contactUrl: unknown): boolean {
  return typeof cacheUrl === 'string' && typeof contactUrl === 'string' && sameLinkedInHandle(cacheUrl, contactUrl);
}

const STORED = /^\/api\/img\/avatars\/[A-Za-z0-9._/-]+$/;
const hostIs = (raw: string, suffix: string) => {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return u.protocol === 'https:' && (h === suffix || h.endsWith(`.${suffix}`)) ? u.toString() : undefined;
  } catch { return undefined; }
};
/** Our own stored copy. */
export function storedPhoto(raw: unknown): string | undefined {
  return typeof raw === 'string' && STORED.test(raw) && !raw.includes('..') ? raw : undefined;
}
/** Luma avatar: only their CDN. */
export function lumaPhoto(raw: unknown): string | undefined {
  return typeof raw === 'string' ? hostIs(raw, 'lumacdn.com') : undefined;
}
/** LinkedIn photo: our stored copy, or (legacy rows) a licdn URL. */
export function linkedInPhoto(raw: unknown): string | undefined {
  return storedPhoto(raw) ?? (typeof raw === 'string' ? hostIs(raw, 'licdn.com') : undefined);
}

export type PhotoSource = 'uploaded' | 'linkedin' | 'luma';
/**
 * The single photo precedence: a photo the person (or an admin) uploaded, then the
 * LinkedIn photo but only when that LinkedIn is trusted to be them, then Luma.
 */
export function profilePhoto(c: PhotoFields): { url: string; source: PhotoSource } | undefined {
  const uploaded = storedPhoto(c.photoUrl);
  if (uploaded) return { url: uploaded, source: 'uploaded' };
  const li = isTrustedLinkedIn(c) ? linkedInPhoto(c.linkedinPhoto) : undefined;
  if (li) return { url: li, source: 'linkedin' };
  const luma = lumaPhoto(c.avatarUrl);
  return luma ? { url: luma, source: 'luma' } : undefined;
}

/** Real image type from the bytes, never the client-declared MIME. */
export function sniffImage(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // under Vercel's ~4.5 MB request body limit
