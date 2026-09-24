'use client';
import { useEffect, useRef } from 'react';

// One-shot entrance: content is fully visible without JS; below-the-fold blocks fade up once when they first enter view.
export function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.dataset.reveal = 'waiting';
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      node.dataset.reveal = 'shown';
      observer.disconnect();
    }, { rootMargin: '0px 0px -12% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}
