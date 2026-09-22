// Exact static pages only. Unknown routes, event identifiers, account surfaces,
// private links, query strings and fragments are never analytics dimensions.
const PUBLIC_PAGES = new Set(['/', '/events', '/about', '/privacy']);
export function publicAnalyticsPath(path: unknown): string | null {
  return typeof path === 'string' && PUBLIC_PAGES.has(path) ? path : null;
}
export function safePageview(input: {
  event: string;
  properties: Record<string, unknown>;
}, context: { currentPath: string; marker: string; key: string; anonymousId: string }) {
  const path = publicAnalyticsPath(input.properties.public_path);
  if (input.event !== '$pageview' || input.properties.club_pageview !== context.marker || !path || path !== publicAnalyticsPath(context.currentPath)) return null;
  // Reconstruct instead of deleting known sensitive keys. This also excludes
  // new SDK properties, nested person data, referrer, URL, UTM and form content.
  return {
    event: '$pageview',
    properties: {
      token: context.key,
      distinct_id: context.anonymousId,
      $pathname: path,
      $process_person_profile: false,
      $geoip_disable: true,
    },
  };
}
