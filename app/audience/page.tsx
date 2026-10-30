import Link from "next/link";
import { AudienceBreakdown } from "@/components/audience-breakdown";
import { getClubAudience } from "@/lib/audience";
import { getPublicEvents, getRequestTime } from "@/lib/public-events";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Our audience",
  description: "Who comes to AI Discussion Club: an anonymized summary of everyone who has attended our events in Washington, DC.",
};

const number = new Intl.NumberFormat("en-US");

export default async function AudiencePage() {
  const [summary, events, now] = await Promise.all([getClubAudience(), getPublicEvents(), getRequestTime()]);
  const hosted = events.filter((event) => Date.parse(event.endAt || event.startAt) < now).length;
  return <div className="wrap page-content">
    <div className="page-heading">
      <h1>Who comes to the club.</h1>
      <p>An anonymized summary of the {summary ? number.format(summary.people) : ""} people who have joined us{hosted ? ` across ${number.format(hosted)} events` : ""}, built from public professional profiles and updated every hour. Each event page also has its own summary.</p>
    </div>
    {summary ? <AudienceBreakdown summary={summary} /> : <div className="empty-state"><h2>Coming soon.</h2><p>The audience summary is being put together.</p><Link className="button" href="/events">See upcoming events</Link></div>}
  </div>;
}
