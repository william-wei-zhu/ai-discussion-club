import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight, CalendarDays, CalendarPlus, MapPin } from 'lucide-react';
import { eventDate, type PublicEvent } from '@/lib/public-events';
import { googleCalendarUrl, relativeWhen } from '@/lib/event-links';
import { lumaUrl } from '@/lib/site';
const eventHref = (event: PublicEvent) => `/events/${encodeURIComponent(event.id)}`;
const when = (event: PublicEvent) => eventDate(event, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
function DateChip({ event }: { event: PublicEvent }) {
  return <span className="date-chip" aria-hidden="true"><span>{eventDate(event, { month: 'short' })}</span><strong>{eventDate(event, { day: 'numeric' })}</strong></span>;
}
export function EventList({ events }: { events: PublicEvent[] }) {
  if (!events.length) return <div className="empty-state"><CalendarDays size={30} strokeWidth={1.3}/><h3>Our next conversation is taking shape.</h3><p>Find the latest events and registration details on our Luma calendar.</p><a className="button" href={lumaUrl} target="_blank" rel="noopener noreferrer">Visit our Luma calendar</a></div>;
  return <ul className="event-grid">{events.map(event => <li key={event.id}><Link className="event-card" href={eventHref(event)}><span className="event-card-art">{event.coverUrl ? <Image src={event.coverUrl} alt="" width={480} height={480} sizes="(max-width: 700px) 92vw, (max-width: 1100px) 45vw, 380px"/> : <span className="event-card-placeholder" />}<DateChip event={event}/></span><span className="event-card-body"><span className="event-card-when">{when(event)}</span><span className="event-card-title">{event.name}</span>{event.location && <span className="location"><MapPin size={16} aria-hidden="true"/>{event.location}</span>}<span className="event-card-cta">View event <ArrowRight size={17} aria-hidden="true"/></span></span></Link></li>)}</ul>;
}
export function EventSpotlight({ event, now }: { event: PublicEvent; now: number }) {
  return <article className="spotlight"><Link className="spotlight-art" href={eventHref(event)} aria-label={`View ${event.name}`}>{event.coverUrl ? <Image src={event.coverUrl} alt="" width={640} height={640} priority sizes="(max-width: 700px) 92vw, 420px"/> : <span className="event-card-placeholder" />}</Link><div className="spotlight-body"><p className="kicker">Next up · {relativeWhen(event, now)}</p><h2><Link href={eventHref(event)}>{event.name}</Link></h2><p className="spotlight-meta">{eventDate(event, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p>{event.location && <p className="location"><MapPin size={18} aria-hidden="true"/>{event.location}</p>}<div className="button-row"><a className="button" href={event.url} target="_blank" rel="noopener noreferrer">Save my spot on Luma <ArrowUpRight size={18} aria-hidden="true"/></a><a className="button secondary" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={18} aria-hidden="true"/>Add to calendar</a></div></div></article>;
}
