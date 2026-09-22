import Link from 'next/link';
export default function NotFound() { return <section className="wrap page-content empty-state"><h1>This page isn’t here.</h1><p>The link may have changed, or the event may not be public.</p><Link className="button" href="/events">Explore events</Link></section>; }
