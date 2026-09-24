import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/guard";
import { db } from "@/lib/firebase-admin";
import { DIRECTORY_ACCESS, decryptToken, directoryUrl, issueDirectoryLink } from "@/lib/directory";

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function admin(req: Request) {
  return (await requireAdmin(req)) && rateLimit(clientIp(req), "directory-admin", 60);
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await admin(req))) return json({ error: "Unauthorized" }, 401);
  const { eventId } = await params;
  const snap = await db().collection(DIRECTORY_ACCESS).doc(eventId).get();
  const data = snap.data();
  // The link is fixed: shown every time. A legacy hash-only link has no url and
  // must be replaced once to become permanent.
  const token = data?.enabled === true ? decryptToken(data.tokenEnc) : null;
  return json({
    enabled: data?.enabled === true,
    ...(token ? { url: directoryUrl(token) } : {}),
    ...(typeof data?.version === "number" ? { version: data.version } : {}),
    ...(typeof data?.createdAt === "number" ? { createdAt: data.createdAt } : {}),
    ...(typeof data?.rotatedAt === "number" ? { rotatedAt: data.rotatedAt } : {}),
    ...(typeof data?.revokedAt === "number" ? { revokedAt: data.revokedAt } : {}),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await admin(req))) return json({ error: "Unauthorized" }, 401);
  const { eventId } = await params;
  const event = await db().collection("clubEvents").doc(eventId).get();
  if (!event.exists) return json({ error: "Unknown event." }, 404);
  const body = await req.json().catch(() => null) as { action?: unknown } | null;
  if (body?.action !== "generate" && body?.action !== "rotate") return json({ error: "Invalid action." }, 400);
  const ref = db().collection(DIRECTORY_ACCESS).doc(eventId);
  const current = await ref.get();
  if (body.action === "generate" && current.data()?.enabled === true) {
    return json({ error: "Replace the active link to change it." }, 409);
  }
  const { url, version } = await issueDirectoryLink(eventId, "verified admin");
  return json({ enabled: true, version, url });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await admin(req))) return json({ error: "Unauthorized" }, 401);
  const { eventId } = await params;
  const ref = db().collection(DIRECTORY_ACCESS).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return json({ enabled: false });
  await ref.set({ enabled: false, revokedAt: Date.now(), revokedBy: "verified admin" }, { merge: true });
  return json({ enabled: false });
}
