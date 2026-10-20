'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/demo', label: 'Demo your project' },
  { href: '/workshops', label: 'Workshops' },
  { href: '/about', label: 'About' },
  { href: '/settings', label: 'Settings' },
];

// Phone and small tablet header menu: the inline links are hidden at that width, so they all live here.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return <div className="mobile-menu" ref={rootRef}>
    <button ref={buttonRef} type="button" className="icon-button mobile-menu-toggle" aria-expanded={open} aria-controls="mobile-menu-panel" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((value) => !value)}>
      {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
    </button>
    <nav id="mobile-menu-panel" className="mobile-menu-panel" aria-label="Mobile navigation" hidden={!open}>
      {LINKS.map((link) => {
        const current = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return <Link key={link.href} href={link.href} aria-current={current ? 'page' : undefined} onClick={() => setOpen(false)}>{link.label}</Link>;
      })}
    </nav>
  </div>;
}
