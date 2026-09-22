import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { siteName, siteUrl, tagline, isCanonical } from '@/lib/site';
import './globals.css';
const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-display' });
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' });
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl), title: { default: tagline, template: `%s | ${siteName}` },
  description: 'A community for curious minds, builders, and conversations about AI in Washington, DC.',
  robots: { index: isCanonical, follow: isCanonical },
  openGraph: { title: siteName, description: tagline, type: 'website' },
  twitter: { card: 'summary_large_image', title: siteName, description: tagline },
  icons: { icon: '/brand/logo.png', apple: '/brand/logo.png' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className={`${display.variable} ${body.variable}`}><Providers><a className="skip-link" href="#main">Skip to content</a><SiteHeader /><main id="main">{children}</main><SiteFooter /></Providers></body></html>;
}
