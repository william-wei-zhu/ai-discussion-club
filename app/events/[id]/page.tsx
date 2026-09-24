import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, CalendarDays, CalendarPlus, Clock, MapPin } from 'lucide-react';
import { eventDate, getPublicEvents, getRequestTime } from '@/lib/public-events';
import { googleCalendarUrl, mapsUrl, plainParagraphs, relativeWhen } from '@/lib/event-links';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = (await getPublicEvents()).find(item => item.id === id);
  return { title: event?.name || 'Event not found' };
}
export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = (await getPublicEvents()).find(item => item.id === id);
  if (!event) notFound();
  const now = await getRequestTime();
  const past = Date.parse(event.endAt || event.startAt) < now;
  const time = eventDate(event, { hour: 'numeric', minute: '2-digit' }) + (event.endAt ? `–${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: event.timezone || 'America/New_York' }).format(new Date(event.endAt))}` : '');
  const recap = event.recap ? plainParagraphs(event.recap) : [];
  const description = event.description ? plainParagraphs(event.description) : [];
  const photos = event.photos || [];
  return <article className="wrap page-content event-detail">
    <Link href={past ? '/events?view=past' : '/events'} className="button secondary back-link"><ArrowLeft size={18} aria-hidden="true"/>{past ? 'Past events' : 'All events'}</Link>
    <div className="page-heading"><p className="kicker">{past ? 'Past event' : relativeWhen(event, now)}</p><h1>{event.name}</h1></div>
    <div className="event-detail-grid">
      <div className="event-detail-main">
        {event.coverUrl && <a className="event-cover-link" href={event.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${event.name} on Luma`}><Image className="event-cover" src={event.coverUrl} alt="" width={900} height={900} priority sizes="(max-width: 700px) 92vw, 60vw" /></a>}
        {recap.length > 0 && <section className="prose"><h2>From the conversation</h2>{recap.map((p, i) => <p key={i}>{p}</p>)}</section>}
        {photos.length > 0 && <div className="event-photos">{photos.map((src, i) => <Image key={src} src={src} alt={`Photo ${i + 1} from ${event.name}`} width={900} height={650} unoptimized/>)}</div>}
        {description.length > 0 ? <section className="prose">{recap.length > 0 && <h2>About the event</h2>}{description.map((p, i) => <p key={i}>{p}</p>)}</section> : <p className="prose">The full agenda, speakers and any updates live on the event’s Luma page.</p>}
      </div>
      <aside className="info-panel">
        <h2>{past ? 'Thanks for coming' : 'Come join us'}</h2>
        <ul className="info-list">
          <li><CalendarDays size={20} aria-hidden="true"/><span>{eventDate(event)}</span></li>
          <li><Clock size={20} aria-hidden="true"/><span>{time}</span></li>
          {event.location && <li><MapPin size={20} aria-hidden="true"/><span>{event.location}<br /><a href={mapsUrl(event.location)} target="_blank" rel="noopener noreferrer">Open in Maps</a></span></li>}
        </ul>
        <div className="button-stack">
          <a className="button" href={event.url} target="_blank" rel="noopener noreferrer">{past ? 'View on Luma' : 'Register on Luma'}<ArrowUpRight size={18} aria-hidden="true"/></a>
          {!past && <a className="button secondary" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={18} aria-hidden="true"/>Add to calendar</a>}
        </div>
        <p className="small">Registration and the latest event details are managed on Luma.</p>
      </aside>
    </div>
  </article>;
}
