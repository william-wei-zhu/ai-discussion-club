import Link from 'next/link';
import Image from 'next/image';
import { Settings } from 'lucide-react';
export function SiteHeader() {
  return <header className="site-header wrap"><Link href="/" className="brand" aria-label="AI Discussion Club home"><Image src="/brand/logo.png" alt="AI Discussion Club" width={100} height={100} priority /><span>AI Discussion<br />Club</span></Link><nav aria-label="Main navigation"><Link href="/events">Events</Link><Link href="/about">About</Link><Link href="/settings" className="icon-button" aria-label="Settings"><Settings size={21} /></Link></nav></header>;
}
export function SiteFooter() {
  return <footer className="site-footer wrap"><div className="footer-top"><Link className="footer-title" href="/">AI Discussion Club</Link><p>Good questions. Real connections. Washington, DC.</p></div><div className="footer-bottom"><a href="https://www.linkedin.com/in/william-wei-zhu/" target="_blank" rel="noopener noreferrer">Built by William Zhu</a><nav aria-label="Footer"><Link href="/privacy">Privacy</Link><Link href="/settings">Settings</Link><Link href="/admin">Admin</Link></nav></div></footer>;
}
