import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/firebase-admin';
import { projectPublicEvent, type PublicEvent } from './public-event-projection';
export type { PublicEvent } from './public-event-projection';
export async function getPublicEvents(): Promise<PublicEvent[]> {
  try {
    if (process.env.PUBLIC_EVENTS_SOURCE === 'snapshot') return readPublicSnapshot();
    const snapshot = await db().collection('clubEvents').where('visibility', '==', 'public').get();
    return snapshot.docs.map(doc => projectPublicEvent(doc.id, doc.data())).filter((event): event is PublicEvent => !!event).sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
  } catch { return []; }
}
async function readPublicSnapshot(): Promise<PublicEvent[]> {
  try {
    const data: unknown = JSON.parse(await readFile(path.join(process.cwd(), 'public/events.json'), 'utf8'));
    if (!Array.isArray(data)) return [];
    // This committed snapshot is independently curated from explicitly public source events.
    return data.map(item => item && typeof item === 'object' ? projectPublicEvent(String(item.id), { ...item, visibility: 'public' }) : null).filter((event): event is PublicEvent => !!event).sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
  } catch { return []; }
}

export function eventDate(event: PublicEvent, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }): string {
  let timeZone = event.timezone || 'America/New_York';
  try { new Intl.DateTimeFormat('en-US', { timeZone }); } catch { timeZone = 'America/New_York'; }
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(new Date(event.startAt));
}

// Read time on the request's server boundary, never freeze event status at build.
export async function getRequestTime(): Promise<number> { return Date.now(); }
