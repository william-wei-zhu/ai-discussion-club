import Link from 'next/link';
import { EventList } from '@/components/event-list';
import { getPublicEvents, getRequestTime } from '@/lib/public-events';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Events' };
export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const past = params.view === 'past';
  const all = await getPublicEvents();
  const now = await getRequestTime();
  const filtered = all.filter(event => (Date.parse(event.endAt || event.startAt) < now) === past);
  if (!past) filtered.reverse();
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.page || '1', 10) || 1));
  const visible = filtered.slice((page - 1) * 12, page * 12);
  const pageUrl = (p: number) => `/events?view=${past ? 'past' : 'upcoming'}&page=${p}#events`;
  return <div className="wrap page-content"><div className="page-heading"><h1>Find your next<br />conversation.</h1><p>Meet the people exploring what AI makes possible.</p></div><nav className="tabs" aria-label="Event period"><Link href="/events" aria-current={!past ? 'page' : undefined}>Upcoming</Link><Link href="/events?view=past" aria-current={past ? 'page' : undefined}>Past events</Link></nav><section id="events" aria-label={past ? 'Past events' : 'Upcoming events'}>{past && !visible.length ? <div className="empty-state"><h2>The story is still being gathered.</h2><p>Past event details will appear here when they’re available.</p><Link className="button secondary" href="/about">Explore the club</Link></div> : <EventList events={visible}/>}</section>{filtered.length > 0 && <div className="pagination"><p>{(page - 1) * 12 + 1}–{Math.min(page * 12, filtered.length)} of {filtered.length} events</p><nav aria-label="Pagination">{page > 1 && <Link className="button secondary" href={pageUrl(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link className="button secondary" href={pageUrl(page + 1)}>Next</Link>}</nav></div>}</div>;
}
