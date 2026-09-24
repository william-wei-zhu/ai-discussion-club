import { after, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { db, verifyRequest } from "@/lib/firebase-admin";
import { setEmailOptOut, clearBounce, CONTACTS, enrichContacts } from "@/lib/club";
import { confirmLinkedInCandidate, ProfileInputError, rejectLinkedInCandidate, setLinkedIn } from "@/lib/profile";
import { profileView } from "@/lib/profile-rules";
import type { ClubContact } from "@/lib/types";

// POST /api/events/contact/[contactId] — per-contact list and profile actions.
//   { action: "resubscribe" }        put someone back on the club list
//   { action: "optout" }             take someone off by hand (same as their own link)
//   { action: "clear-bounce" }       retry an address a send previously failed on
//   { action: "set-linkedin", url }  admin-set LinkedIn (locked against enrichment)
//   { action: "clear-linkedin" }     remove it; the nightly search may look again
//   { action: "confirm-linkedin" }   accept the pending Exa guess as theirs
//   { action: "reject-linkedin" }    drop the guess; it is not offered again
//
// Action allowlist rather than free-form fields: an unknown action is a 400, never a
// partial write. Every response carries the contact's fresh state so the admin UI
// shows what the server actually stored (resubscribe, for instance, keeps a bounce).
const ACTIONS = ["resubscribe", "optout", "clear-bounce", "set-linkedin", "clear-linkedin", "confirm-linkedin", "reject-linkedin"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const { contactId } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; url?: unknown };
  const action = String(body.action ?? "") as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}.` }, { status: 400 });
  }
  const ref = db().collection(CONTACTS).doc(contactId);
  if (!(await ref.get()).exists) return NextResponse.json({ error: "Unknown contact." }, { status: 404 });
  const auth = await verifyRequest(req);
  const by = auth?.email ?? "admin";

  try {
    let refresh = false;
    if (action === "resubscribe") await setEmailOptOut(contactId, false, by);
    if (action === "optout") await setEmailOptOut(contactId, true, by);
    if (action === "clear-bounce") await clearBounce(contactId, by);
    if (action === "set-linkedin") {
      if (typeof body.url !== "string") return NextResponse.json({ error: "Enter a LinkedIn profile link." }, { status: 400 });
      refresh = !!(await setLinkedIn(contactId, body.url, "admin"));
    }
    if (action === "clear-linkedin") await setLinkedIn(contactId, null, "admin");
    if (action === "confirm-linkedin") refresh = !!(await confirmLinkedInCandidate(contactId));
    if (action === "reject-linkedin") await rejectLinkedInCandidate(contactId);
    // Read the corrected profile now rather than at tonight's run. Budget caps apply.
    if (refresh) after(() => enrichContacts({ contactIds: [contactId], deadlineMs: Date.now() + 50_000 }).catch(() => undefined));
    const c = (await ref.get()).data() as ClubContact;
    return NextResponse.json({
      ok: true,
      action,
      contactId,
      contact: { emailOptOut: !!c.emailOptOut, emailBouncedAt: c.emailBouncedAt ?? null, linkedinCandidate: c.linkedinCandidate ?? null, profile: profileView(c) },
    });
  } catch (e) {
    if (e instanceof ProfileInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
