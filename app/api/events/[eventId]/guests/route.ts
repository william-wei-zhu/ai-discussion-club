import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { getEvent, getEventGuests, CONTACTS } from "@/lib/club";
import { db } from "@/lib/firebase-admin";
import type { ClubContact } from "@/lib/types";
import { profilePhoto, profileView, trustedLinkedInUrl } from "@/lib/profile-rules";

// GET /api/events/[eventId]/guests — one event's registrations, joined to the CRM
// contact for the LinkedIn state, plus the coverage totals that tell the admin at a
// glance how good this event's recommendations can possibly be.
//
// Coverage is the honest headline number here: an event where only a third of
// confirmed guests wrote anything caps how personal the emails can get, and the
// fix is upstream (the Luma registration questions), not in the matcher.
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { eventId } = await params;

  const [event, guests] = await Promise.all([getEvent(eventId), getEventGuests(eventId)]);
  if (!event) return NextResponse.json({ error: "Unknown event." }, { status: 404 });

  // One fan-out read of just the contact fields the table shows. Never the signal
  // subcollection, so no embeddings can reach the client.
  const ids = guests.map((g) => g.id);
  const contacts = new Map<string, ClubContact>();
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map((id) => db().collection(CONTACTS).doc(id));
    if (!refs.length) continue;
    const snaps = await db().getAll(...refs, {
      fieldMask: [
        "name",
        "tags",
        "avatarUrl",
        "photoUrl",
        "linkedinPhoto",
        "headline",
        "linkedinUrl",
        "linkedinSource",
        "linkedinConfidence",
        "linkedinCandidate",
        "photoSource",
        "emailOptOut",
        "emailBouncedAt",
        "eventApprovedCount",
        "eventCheckedInCount",
        "signalTier",
      ],
    });
    for (const s of snaps) if (s.exists) contacts.set(s.id, { ...(s.data() as ClubContact), id: s.id });
  }

  const rows = guests.map((g) => {
    const c = contacts.get(g.id);
    const trustedLinkedIn = c ? trustedLinkedInUrl(c) : undefined;
    const photo = c ? profilePhoto(c) : undefined;
    return {
      ...g,
      tags: c?.tags ?? [],
      // The same photo the directory and emails will show, and where it came from.
      avatarUrl: photo?.url,
      photoSource: photo?.source,
      profile: profileView(c),
      headline: c?.headline,
      // Only a trusted URL is presented as the person's LinkedIn; a low-confidence
      // Exa hit stays in `linkedinCandidate` for the Confirm/Reject buttons.
      linkedinUrl: trustedLinkedIn,
      linkedinSource: trustedLinkedIn ? c?.linkedinSource : undefined,
      linkedinCandidate: trustedLinkedIn ? undefined : c?.linkedinCandidate,
      optOut: !!c?.emailOptOut,
      bouncedAt: c?.emailBouncedAt,
      eventApprovedCount: c?.eventApprovedCount ?? 0,
      contactSignalTier: c?.signalTier,
    };
  });

  // Organizers count as attending: the coverage numbers must match who is actually
  // emailed, or the page understates the blast.
  const approved = rows.filter((r) => r.approvalStatus === "approved" || r.isHost);
  const coverage = {
    approved: approved.length,
    withAnswers: approved.filter((r) => r.hasAnswers).length,
    withLinkedIn: approved.filter((r) => r.linkedinUrl).length,
    zeroSignal: approved.filter((r) => !r.hasAnswers && !r.linkedinUrl).length,
    optedOut: approved.filter((r) => r.optOut).length,
    candidates: approved.filter((r) => r.linkedinCandidate).length,
    // What the blast would actually reach right now.
    recipients: approved.filter((r) => !r.optOut && !r.bouncedAt && r.email).length,
  };

  return NextResponse.json({ event, guests: rows, coverage });
}
