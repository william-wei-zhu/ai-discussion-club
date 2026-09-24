import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { enrichContacts } from "@/lib/club";
import { chargeProfileChange, consentPatch, endPreferenceSession, memberEvents, PREFERENCE_COOKIE, preferenceSession, requestOriginAllowed } from "@/lib/preferences";
import { ProfileInputError, setLinkedIn } from "@/lib/profile";
import { profileView } from "@/lib/profile-rules";
import type { ClubContact } from "@/lib/types";

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function session() {
  return preferenceSession((await cookies()).get(PREFERENCE_COOKIE)?.value);
}

export async function GET() {
  const auth = await session();
  if (!auth) return json({ error: "Your preference session has expired." }, 401);
  const [contact, events] = await Promise.all([
    db().collection("clubContacts").doc(auth.contactId).get(),
    memberEvents(auth.contactId, auth.email),
  ]);
  const refs = events.map((event) => db().collection("clubEvents").doc(event.id).collection("directoryConsent").doc(auth.contactId));
  const consents = refs.length ? await db().getAll(...refs) : [];
  // Opt-out model: listed unless they explicitly turned it off.
  const enabled = new Map(consents.map((snap) => [snap.ref.parent.parent?.id, snap.data()?.enabled !== false]));
  const data = contact.data() as ClubContact | undefined;
  return json({
    emailOptOut: data?.emailOptOut === true,
    profile: profileView(data),
    events: events.map((event) => ({ ...event, directoryEnabled: enabled.get(event.id) !== false })),
  });
}

export async function PATCH(req: Request) {
  if (!requestOriginAllowed(req)) return json({ error: "Invalid request origin." }, 403);
  const auth = await session();
  if (!auth) return json({ error: "Your preference session has expired." }, 401);
  const body = await req.json().catch(() => null) as { emailOptOut?: unknown; directory?: unknown; linkedinUrl?: unknown } | null;
  if (!body || (body.emailOptOut === undefined && body.directory === undefined && body.linkedinUrl === undefined)) return json({ error: "No preference was provided." }, 400);

  // A LinkedIn change is its own request: it is rate limited and triggers a
  // background refresh of the profile it points at.
  if (body.linkedinUrl !== undefined) {
    if (body.linkedinUrl !== null && typeof body.linkedinUrl !== "string") return json({ error: "Invalid LinkedIn link." }, 400);
    if (!(await chargeProfileChange(auth.contactId))) return json({ error: "You have changed your profile several times today. Please try again tomorrow." }, 429);
    try {
      const url = await setLinkedIn(auth.contactId, body.linkedinUrl, "self");
      // Read the new profile now instead of waiting for the nightly run, so matching
      // and the directory reflect it before the next event. Budget caps still apply.
      if (url) after(() => enrichContacts({ contactIds: [auth.contactId], deadlineMs: Date.now() + 50_000 }).catch(() => undefined));
    } catch (error) {
      if (error instanceof ProfileInputError) return json({ error: error.message }, 400);
      throw error;
    }
    const fresh = await db().collection("clubContacts").doc(auth.contactId).get();
    return json({ ok: true, profile: profileView(fresh.data() as ClubContact | undefined) });
  }

  let emailOptOut: boolean | undefined;
  let directoryWrite: { eventId: string; patch: NonNullable<ReturnType<typeof consentPatch>> } | undefined;
  if (body.emailOptOut !== undefined) {
    if (typeof body.emailOptOut !== "boolean") return json({ error: "Invalid email preference." }, 400);
    emailOptOut = body.emailOptOut;
  }
  if (body.directory !== undefined) {
    if (!body.directory || typeof body.directory !== "object") return json({ error: "Invalid directory preference." }, 400);
    const directory = body.directory as { eventId?: unknown; enabled?: unknown };
    if (typeof directory.eventId !== "string") return json({ error: "Invalid event." }, 400);
    const patch = consentPatch(directory.enabled);
    if (!patch) return json({ error: "Invalid directory preference." }, 400);
    const memberships = await memberEvents(auth.contactId, auth.email);
    if (!memberships.some((event) => event.id === directory.eventId)) return json({ error: "Unknown event." }, 404);
    directoryWrite = { eventId: directory.eventId, patch };
  }
  const batch = db().batch();
  if (emailOptOut !== undefined) batch.set(db().collection("clubContacts").doc(auth.contactId), { emailOptOut, ...(emailOptOut ? { optOutAt: Date.now() } : { resubscribedAt: Date.now(), resubscribedBy: "email-verified preference link" }) }, { merge: true });
  if (directoryWrite) batch.set(db().collection("clubEvents").doc(directoryWrite.eventId).collection("directoryConsent").doc(auth.contactId), directoryWrite.patch);
  await batch.commit();
  return json({ ok: true });
}

/** Sign out: end the session server-side and clear the cookie. */
export async function DELETE(req: Request) {
  if (!requestOriginAllowed(req)) return json({ error: "Invalid request origin." }, 403);
  const jar = await cookies();
  await endPreferenceSession(jar.get(PREFERENCE_COOKIE)?.value);
  const response = json({ ok: true });
  response.cookies.set(PREFERENCE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
