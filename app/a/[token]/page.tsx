import Link from "next/link";
import { notFound } from "next/navigation";
import { AudienceBreakdown } from "@/components/audience-breakdown";
import { eventAudience } from "@/lib/audience";
import { AUDIENCE_LINK, eventIdForToken } from "@/lib/directory";
import { getRequestTime } from "@/lib/public-events";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

// A private, anonymized summary of who is coming to (or came to) one event, for
// sponsors and speakers the organizer shares the link with.
export default async function EventAudiencePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const eventId = await eventIdForToken(token, AUDIENCE_LINK);
  const result = eventId ? await eventAudience(eventId) : null;
  if (!result) notFound();
  const now = await getRequestTime();
  const past = typeof result.event.startAt === "number" && result.event.startAt < now;
  const who = result.checkedIn ? "people who checked in" : past ? "people who registered and were approved" : "people registered and approved so far";
  return <div className="wrap page-content">
    <div className="page-heading">
      <p>Event audience</p>
      <h1>{result.event.name}</h1>
      <p>{result.event.startAt ? `${dateFormat.format(new Date(result.event.startAt))}. ` : ""}An anonymized summary of the {who}, from their public professional profiles. Shared privately by the organizer.</p>
    </div>
    <AudienceBreakdown summary={result} />
    <p className="audience-coverage mt-10">For the whole club across all events, see <Link href="/audience">our audience</Link>.</p>
  </div>;
}
