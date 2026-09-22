// Coarse, low-precision relative time for post timestamps. Intentionally vague
// ("a few hours ago") so it stays small and never dominates the card.
export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < 0) return "just now";
  if (diff < 5 * min) return "just now";
  if (diff < hour) return "a few minutes ago";
  if (diff < 2 * hour) return "an hour ago";
  if (diff < day) return "a few hours ago";
  if (diff < 2 * day) return "yesterday";
  if (diff < week) return "a few days ago";
  if (diff < 5 * week) return "a few weeks ago";
  return "a while ago";
}
