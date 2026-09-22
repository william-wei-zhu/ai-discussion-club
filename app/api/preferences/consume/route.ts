import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { PREFERENCE_COOKIE, SESSION_TTL_MS, preferenceHash, preferenceToken, requestOriginAllowed, validPreferenceToken } from "@/lib/preferences";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!requestOriginAllowed(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  const body = await req.json().catch(() => null) as { token?: unknown } | null;
  if (!validPreferenceToken(body?.token)) return NextResponse.json({ error: "This link is invalid or expired." }, { status: 404, headers });
  const tokenRef = db().collection("preferenceTokens").doc(preferenceHash(body.token));
  const session = preferenceToken();
  const now = Date.now();
  const consumed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);
    const data = snap.data();
    if (!data || data.usedAt || Number(data.expiresAt) <= now || typeof data.email !== "string" || typeof data.contactId !== "string") return null;
    tx.update(tokenRef, { usedAt: now });
    tx.set(db().collection("preferenceSessions").doc(preferenceHash(session)), { email: data.email, contactId: data.contactId, createdAt: now, expiresAt: now + SESSION_TTL_MS });
    return true;
  });
  if (!consumed) return NextResponse.json({ error: "This link is invalid or expired." }, { status: 404, headers });
  const response = NextResponse.json({ ok: true }, { headers });
  const host = new URL(req.url).hostname;
  response.cookies.set(PREFERENCE_COOKIE, session, { httpOnly: true, sameSite: "lax", secure: !(process.env.NODE_ENV !== "production" && (host === "localhost" || host === "127.0.0.1")), path: "/", maxAge: SESSION_TTL_MS / 1000 });
  return response;
}
