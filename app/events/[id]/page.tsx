import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { eventDate, getPublicEvents, getRequestTime } from '@/lib/public-events';
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
  return <article className="wrap page-content event-detail"><Link href="/events" className="text-link">All events</Link><div className="page-heading"><p>{eventDate(event)}</p><h1>{event.name}</h1></div><div className="event-detail-grid"><div className="prose">{event.coverUrl && <Image className="event-cover" src={event.coverUrl} alt="" width={900} height={900} sizes="(max-width: 700px) 92vw, 60vw" />}{event.description ? <p className="preserve-lines">{event.description}</p> : <p>Visit the event page on Luma for the full description and gathering details.</p>}{event.recap && <><h2>From the conversation</h2><p className="preserve-lines">{event.recap}</p></>}</div><aside className="info-panel"><h2>{past ? 'A past gathering' : 'Come join us'}</h2><p>{eventDate(event, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p>{event.location && <p>{event.location}</p>}<a className="button" href={event.url} target="_blank" rel="noopener noreferrer">{past ? 'View on Luma' : 'Register on Luma'}</a><p className="small">Registration and the latest event details are managed on Luma.</p></aside></div></article>;
}
