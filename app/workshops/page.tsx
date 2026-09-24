import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { WORKSHOPS, workshopPath } from '@/lib/workshops';

export const metadata: Metadata = {
  title: 'Workshops',
  description: 'Free, step-by-step AI Discussion Club workshops you can follow live in the room or at your own pace.',
};

export default function WorkshopsPage() {
  return <div className="wrap page-content"><div className="page-heading"><h1>Workshops.</h1><p>Hands-on sessions we run at the club, written so you can follow along live in the room or at your own pace. Pick one and start building.</p></div><ul className="event-grid">{WORKSHOPS.map(w => <li key={w.slug}><Link href={workshopPath(w.slug)} className="event-card"><span className="event-card-art"><Image src={w.cover.src} alt={w.cover.alt} width={1254} height={1254} sizes="(max-width: 700px) 92vw, 400px" /></span><span className="event-card-body"><span className="event-card-when location"><Clock size={15} aria-hidden="true" />{w.duration} · {w.tools}</span><span className="event-card-title">{w.title}</span><span className="workshop-card-blurb">{w.blurb}</span><span className="event-card-cta">Start the workshop <ArrowRight size={16} aria-hidden="true" /></span></span></Link></li>)}</ul></div>;
}
