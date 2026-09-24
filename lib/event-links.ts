import type { PublicEvent } from './public-event-projection';

const DAY = 86_400_000;
const zoneOf = (event: PublicEvent) => {
  const zone = event.timezone || 'America/New_York';
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return zone; } catch { return 'America/New_York'; }
};
// Calendar-day index in the event's own time zone, so "tomorrow" matches the city, not the server.
const dayIndex = (ms: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  return Math.round(Date.parse(`${parts}T00:00:00Z`) / DAY);
};

/** A short, human "when" for the next-event spotlight: Today, Tomorrow, This Sunday, In 12 days. */
export function relativeWhen(event: PublicEvent, now: number): string {
  const zone = zoneOf(event);
  const start = Date.parse(event.startAt);
  const end = Date.parse(event.endAt || event.startAt);
  if (start <= now && now <= end) return 'Happening now';
  const days = dayIndex(start, zone) - dayIndex(now, zone);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `This ${new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long' }).format(new Date(start))}`;
  return `In ${days} days`;
}

const calendarStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Google Calendar "add event" link. Uses only public event fields. */
export function googleCalendarUrl(event: PublicEvent): string {
  const end = event.endAt || new Date(Date.parse(event.startAt) + 2 * 3_600_000).toISOString();
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.name, dates: `${calendarStamp(event.startAt)}/${calendarStamp(end)}`, details: `Register and see the latest details: ${event.url}` });
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

/** Luma descriptions arrive as Markdown. Reduce to plain paragraphs so the page keeps one uniform text style. */
export function plainParagraphs(markdown: string): string[] {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]{0,3}#{1,6}\s+/gm, '')
    .replace(/^[ \t]{0,3}>\s?/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);
}
