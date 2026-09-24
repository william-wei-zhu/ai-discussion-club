import type { MetadataRoute } from 'next';
import { isCanonical, siteUrl } from '@/lib/site';
import { getPublicEvents } from '@/lib/public-events';
import { WORKSHOPS, workshopPath } from '@/lib/workshops';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { if (!isCanonical) return []; const events = await getPublicEvents(); return [...['', '/events', '/demo', '/workshops', '/about', '/privacy', ...WORKSHOPS.map(w => workshopPath(w.slug))].map(path => ({ url: `${siteUrl}${path}` })), ...events.map(event => ({ url: `${siteUrl}/events/${encodeURIComponent(event.id)}` }))]; }
