import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase-admin';
import { SUBMISSIONS_READ_LIMIT, WORKSHOP_SUBMISSIONS, displayHost, toSubmission, workshopTitle, type WorkshopSubmission } from '@/lib/workshop-submissions';

export const dynamic = 'force-dynamic';
// User-submitted links: kept out of search engines, and not in the sitemap.
export const metadata: Metadata = {
  title: 'Built at our workshops',
  description: 'Apps people built at AI Discussion Club workshops.',
  robots: { index: false, follow: false },
};

async function visibleSubmissions(): Promise<WorkshopSubmission[] | null> {
  try {
    const snap = await db().collection(WORKSHOP_SUBMISSIONS).orderBy('createdAt', 'desc').limit(SUBMISSIONS_READ_LIMIT).get();
    return snap.docs.map(d => toSubmission(d.id, d.data())).filter(s => !s.hidden);
  } catch (e) {
    console.error('Workshop gallery read failed.', (e as Error).message);
    return null;
  }
}

const fmt = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

export default async function WorkshopSubmissionsPage() {
  const rows = await visibleSubmissions();
  return <div className="wrap page-content"><Link href="/workshops" className="text-link back-link inline-block">← All workshops</Link><div className="page-heading"><h1>Built at our workshops.</h1><p>Everything people made and shared at the end of a workshop, newest first. Open one and see what a first build looks like.</p></div>
    {rows === null ? <div className="empty-state"><h3>The gallery is taking a break.</h3><p>We could not load submissions just now. Try again in a minute.</p></div>
    : rows.length === 0 ? <div className="empty-state"><Sparkles size={36} aria-hidden="true" /><h3>Nothing here yet.</h3><p>Finish a workshop and add your app on the last step. It shows up here right away.</p><Link className="button" href="/workshops">Pick a workshop</Link></div>
    : <ul className="gallery-list">{rows.map(s => <li key={s.id}><a className="gallery-item" href={s.url} target="_blank" rel="noopener noreferrer nofollow ugc"><span className="gallery-name">{s.name}</span><span className="gallery-host">{displayHost(s.url)} <ArrowUpRight size={16} aria-hidden="true" /></span><span className="gallery-meta">{workshopTitle(s.workshop)} · {fmt(s.createdAt)}</span></a></li>)}</ul>}
  </div>;
}
