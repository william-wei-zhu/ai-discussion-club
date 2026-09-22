import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { consentPatch, memberEvents, PREFERENCE_COOKIE, preferenceSession, requestOriginAllowed } from "@/lib/preferences";

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
  const enabled = new Map(consents.map((snap) => [snap.ref.parent.parent?.id, snap.data()?.enabled === true]));
  return json({
    emailOptOut: contact.data()?.emailOptOut === true,
    events: events.map((event) => ({ ...event, directoryEnabled: enabled.get(event.id) === true })),
  });
}

export async function PATCH(req: Request) {
  if (!requestOriginAllowed(req)) return json({ error: "Invalid request origin." }, 403);
  const auth = await session();
  if (!auth) return json({ error: "Your preference session has expired." }, 401);
  const body = await req.json().catch(() => null) as { emailOptOut?: unknown; directory?: unknown } | null;
  if (!body || (body.emailOptOut === undefined && body.directory === undefined)) return json({ error: "No preference was provided." }, 400);
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
  const writes: Promise<unknown>[] = [];
  if (emailOptOut !== undefined) writes.push(db().collection("clubContacts").doc(auth.contactId).set({ emailOptOut, ...(emailOptOut ? { optOutAt: Date.now() } : { resubscribedAt: Date.now(), resubscribedBy: "email-verified preference link" }) }, { merge: true }));
  if (directoryWrite) writes.push(db().collection("clubEvents").doc(directoryWrite.eventId).collection("directoryConsent").doc(auth.contactId).set(directoryWrite.patch));
  await Promise.all(writes);
  return json({ ok: true });
}
