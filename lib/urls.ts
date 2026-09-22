// One URL matcher shared by the linkifier (client) and OG fetch (server).
// Matches full http(s) URLs, www.* , and bare domains with a known TLD
// (so "node.js", decimals, and email local parts aren't linkified).
export const URL_REGEX =
  /(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+|(?<![@\w./-])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|ai|co|dev|app|xyz|me|gg|so|to|info|biz|tech|page|link|fyi|news|blog|email|club|us|uk|ca)\b(?:\/[^\s<>"')]*)?)/gi;

// Trailing sentence punctuation that shouldn't be part of the link.
const TRAIL = /[.,);:!?]+$/;

export function trimTrail(raw: string): { shown: string; trail: string } {
  const m = raw.match(TRAIL);
  if (!m) return { shown: raw, trail: "" };
  return { shown: raw.slice(0, -m[0].length), trail: m[0] };
}

export function toHref(shown: string): string {
  return /^https?:\/\//i.test(shown) ? shown : `https://${shown}`;
}

// First URL in a string, normalized to an href (or null).
export function firstUrl(text: string): string | null {
  const m = text.match(URL_REGEX);
  if (!m) return null;
  return toHref(trimTrail(m[0]).shown);
}
