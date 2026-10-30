import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/guard";
import { db, verifyRequest } from "@/lib/firebase-admin";
import { AUDIENCE_LINK, directoryStatus, issueDirectoryLink } from "@/lib/directory";

// The event's private audience link (/a/...): the same fixed, revocable capability
// as the directory link, in its own collection with its own key.
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function gate(req: Request): Promise<NextResponse | null> {
  if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
  if (!rateLimit(clientIp(req), "directory-admin", 120)) return json({ error: "Slow down a moment." }, 429);
  return null;
}

async function who(req: Request) {
  return (await verifyRequest(req))?.email ?? "admin";
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const blocked = await gate(req);
  if (blocked) return blocked;
  const { eventId } = await params;
  return json(directoryStatus((await db().collection(AUDIENCE_LINK.collection).doc(eventId).get()).data(), AUDIENCE_LINK));
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const blocked = await gate(req);
  if (blocked) return blocked;
  const { eventId } = await params;
  const event = await db().collection("clubEvents").doc(eventId).get();
  if (!event.exists) return json({ error: "Unknown event." }, 404);
  const body = await req.json().catch(() => null) as { action?: unknown } | null;
  if (body?.action !== "generate" && body?.action !== "rotate") return json({ error: "Invalid action." }, 400);
  const current = await db().collection(AUDIENCE_LINK.collection).doc(eventId).get();
  if (body.action === "generate" && current.data()?.enabled === true) {
    return json({ error: "This event already has a link. Use Replace link to change it." }, 409);
  }
  const { url, version } = await issueDirectoryLink(eventId, await who(req), {}, AUDIENCE_LINK);
  return json({ enabled: true, version, url });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const blocked = await gate(req);
  if (blocked) return blocked;
  const { eventId } = await params;
  const ref = db().collection(AUDIENCE_LINK.collection).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return json({ enabled: false });
  await ref.set({ enabled: false, revokedAt: Date.now(), revokedBy: await who(req) }, { merge: true });
  return json({ enabled: false, revokedAt: Date.now() });
}
