import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Settings } from 'lucide-react';
import { lumaUrl } from '@/lib/site';
export function SiteHeader() {
  return <header className="site-header wrap"><Link href="/" className="brand" aria-label="AI Discussion Club home"><Image src="/brand/logo.png" alt="AI Discussion Club" width={100} height={100} priority /><span>AI Discussion Club</span></Link><nav aria-label="Main navigation"><Link href="/events">Events</Link><Link href="/demo">Demo</Link><Link href="/workshops">Workshops</Link><Link href="/about">About</Link><a className="button header-cta" href={lumaUrl} target="_blank" rel="noopener noreferrer">Join us</a><Link href="/settings" className="icon-button" aria-label="Settings"><Settings size={21} /></Link></nav></header>;
}
export function SiteFooter() {
  return <footer className="site-footer"><div className="wrap"><div className="footer-top"><p className="footer-tagline">Make DC the City for Innovators.</p><a className="button" href={lumaUrl} target="_blank" rel="noopener noreferrer">Subscribe on Luma <ArrowUpRight size={18} aria-hidden="true"/></a></div><div className="footer-bottom"><Link className="footer-title" href="/"><Image src="/brand/logo.png" alt="" width={44} height={44}/>AI Discussion Club</Link><a href="https://www.linkedin.com/in/william-wei-zhu/" target="_blank" rel="noopener noreferrer">Built by William Zhu</a><nav aria-label="Footer"><Link href="/events">Events</Link><Link href="/demo">Demo your project</Link><Link href="/workshops">Workshops</Link><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/settings">Settings</Link></nav></div></div></footer>;
}
