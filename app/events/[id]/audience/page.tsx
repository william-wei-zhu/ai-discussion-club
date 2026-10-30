import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AudienceBreakdown } from '@/components/audience-breakdown';
import { eventAudience } from '@/lib/audience';
import { eventDate, getPublicEvents, getRequestTime } from '@/lib/public-events';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = (await getPublicEvents()).find(item => item.id === id);
  return event ? { title: `Who's coming: ${event.name}`, description: `An anonymized summary of the people attending ${event.name}.` } : { title: 'Event not found' };
}
// The anonymized audience of one public event. Only aggregates are shown, under
// the privacy rules in lib/demographics.ts; unlisted events 404 like their pages.
export default async function EventAudiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = (await getPublicEvents()).find(item => item.id === id);
  if (!event) notFound();
  const [result, now] = await Promise.all([eventAudience(id), getRequestTime()]);
  if (!result) notFound();
  const past = Date.parse(event.endAt || event.startAt) < now;
  const who = result.checkedIn ? 'people who checked in' : past ? 'people who registered and were approved' : 'people registered and approved so far';
  return <div className="wrap page-content">
    <Link href={`/events/${encodeURIComponent(id)}`} className="button secondary back-link"><ArrowLeft size={18} aria-hidden="true"/>Back to the event</Link>
    <div className="page-heading">
      <h1>{past ? 'Who came' : 'Who’s coming'}</h1>
      <p>{event.name}, {eventDate(event)}. An anonymized summary of the {who}, from their public professional profiles.</p>
    </div>
    <AudienceBreakdown summary={result} />
    <p className="audience-coverage mt-10">For the whole club across all events, see <Link href="/audience">our audience</Link>.</p>
  </div>;
}
