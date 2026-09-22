import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { eventDate, type PublicEvent } from '@/lib/public-events';
import { lumaUrl } from '@/lib/site';
export function EventList({ events }: { events: PublicEvent[] }) {
  if (!events.length) return <div className="empty-state"><CalendarDays size={30} strokeWidth={1.3}/><h3>Our next conversation is taking shape.</h3><p>Find the latest gatherings and registration details on our Luma calendar.</p><a className="button" href={lumaUrl} target="_blank" rel="noopener noreferrer">Visit our Luma calendar</a></div>;
  return <div className="event-list">{events.map(event => <article className="event-row" key={event.id}><div className="event-date"><span>{eventDate(event, { month: 'short' })}</span><strong>{eventDate(event, { day: 'numeric' })}</strong></div><div className="event-info"><p>{eventDate(event, { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p><h3><Link href={`/events/${encodeURIComponent(event.id)}`}>{event.name}</Link></h3>{event.location && <p className="location"><MapPin size={16}/>{event.location}</p>}</div><Link className="button secondary" href={`/events/${encodeURIComponent(event.id)}`}>View event</Link></article>)}</div>;
}
