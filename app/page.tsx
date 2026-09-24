import Image from 'next/image';
import Link from 'next/link';
import { EventList, EventSpotlight } from '@/components/event-list';
import { Reveal } from '@/components/reveal';
import { getPublicEvents, getRequestTime } from '@/lib/public-events';
import { communityPhotos } from '@/lib/site';
import skyline from '@/public/brand/skyline.jpg';
export const dynamic = 'force-dynamic';
// Blossom petals fall once on load, then rest; positions are fixed so server and client render the same.
const petals = [[6, 0, 1], [14, 1.1, .8], [23, .4, 1.15], [34, 1.6, .9], [47, .2, 1], [58, 1.3, .75], [66, .7, 1.2], [75, 1.9, .85], [84, .5, 1.05], [93, 1.4, .9]];
export default async function Home() {
  const events = await getPublicEvents();
  const now = await getRequestTime();
  const upcoming = events.filter(event => Date.parse(event.endAt || event.startAt) >= now).reverse();
  const [next, ...later] = upcoming;
  return <>
    <section className="hero">
      <div className="hero-copy wrap"><h1>Make DC the City<br />for Innovators.</h1><p>A place for curious minds to talk AI,<br className="desktop-break" /> share what they’re building, and find their people.</p><div className="button-row centered"><Link className="button" href="/events">Join a conversation</Link><Link className="button secondary" href="/about">Meet the club</Link></div></div>
      <div className="hero-sky" role="img" aria-label="Washington, DC skyline framed by purple cherry blossoms"><Image src={skyline} alt="" priority placeholder="blur" sizes="100vw"/><div className="petals" aria-hidden="true">{petals.map(([left, delay, scale], i) => <span key={i} style={{ '--left': `${left}%`, '--delay': `${delay}s`, '--scale': scale } as React.CSSProperties} />)}</div></div>
    </section>
    <section className="spotlight-section wrap" aria-label="Next event">{next ? <EventSpotlight event={next} now={now}/> : <EventList events={[]}/>}</section>
    {later.length > 0 && <Reveal className="section wrap"><div className="section-heading"><div><h2>And after that.</h2><p>Save the date for the next few conversations.</p></div><Link className="button secondary" href="/events">All events</Link></div><EventList events={later.slice(0, 3)}/></Reveal>}
    <section className="community-section"><Reveal className="wrap"><div className="section-heading"><h2>Big ideas.<br />Better company.</h2><p>From a first question to a new collaboration,<br className="desktop-break" /> it starts with a conversation.</p></div><div className="photo-montage"><figure><Image src={communityPhotos[0]} alt="AI Discussion Club members gathered after a discussion" width={1820} height={866} sizes="(max-width: 700px) 92vw, (max-width: 1336px) 93vw, 1240px"/></figure><figure><Image src={communityPhotos[1]} alt="Club members together at a bookstore" width={900} height={600} sizes="(max-width: 700px) 92vw, 45vw"/><figcaption>Author talk at a DC bookstore</figcaption></figure><figure><Image src={communityPhotos[2]} alt="Club members in front of the Lincoln Memorial" width={900} height={900} sizes="(max-width: 700px) 92vw, 45vw"/><figcaption>Discussion walk at the Lincoln Memorial</figcaption></figure></div><div className="community-caption"><p>Different backgrounds. A shared curiosity.</p><Link href="/about" className="button secondary">Meet the club</Link></div></Reveal></section>
    <Reveal className="invitation wrap"><Image src="/brand/logo.png" alt="" width={110} height={110}/><h2>There’s a place for<br />your perspective.</h2><p>Come with a question. Leave with a connection.</p><Link className="button" href="/events">Find your next event</Link></Reveal>
  </>;
}
