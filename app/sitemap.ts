import type { MetadataRoute } from 'next';
import { isCanonical, siteUrl } from '@/lib/site';
import { getPublicEvents } from '@/lib/public-events';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { if (!isCanonical) return []; const events = await getPublicEvents(); return [...['', '/events', '/about', '/privacy'].map(path => ({ url: `${siteUrl}${path}` })), ...events.map(event => ({ url: `${siteUrl}/events/${encodeURIComponent(event.id)}` }))]; }
