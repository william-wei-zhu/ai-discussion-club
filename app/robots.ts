import type { MetadataRoute } from 'next';
import { isCanonical, siteUrl } from '@/lib/site';
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: '*', ...(isCanonical ? { allow: '/', disallow: ['/admin', '/g/', '/preferences', '/api/'] } : { disallow: '/' }) }, ...(isCanonical ? { sitemap: `${siteUrl}/sitemap.xml` } : {}) }; }
