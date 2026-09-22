import { Resend } from "resend";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/guard";
import { chargePreferenceEmail, contactForEmail, normalizeEmail, preferenceHash, preferenceToken, requestOriginAllowed, LINK_TTL_MS } from "@/lib/preferences";
import { db } from "@/lib/firebase-admin";
import { siteUrl } from "@/lib/site";

const noStore = { "Cache-Control": "private, no-store" };
const generic = () => NextResponse.json({ ok: true }, { headers: noStore });

export async function POST(req: Request) {
  if (!requestOriginAllowed(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: noStore });
  const ip = clientIp(req);
  if (!rateLimit(ip, "preference-link", 4, 60 * 60 * 1000)) return generic();
  if (process.env.EMAIL_SENDING_ENABLED !== "true") return NextResponse.json({ error: "Preference email is not configured yet." }, { status: 503, headers: noStore });
  const key = process.env.RESEND_API_KEY || process.env.CLUB_RESEND_API_KEY;
  const from = process.env.RESEND_CLUB_FROM;
  if (!key || !from) return NextResponse.json({ error: "Preference email is not configured yet." }, { status: 503, headers: noStore });
  const body = await req.json().catch(() => null) as { email?: unknown } | null;
  const email = normalizeEmail(body?.email);
  if (!email) return generic();
  const contact = await contactForEmail(email);
  if (!contact) return generic();
  if (!(await chargePreferenceEmail(email, ip, Number(process.env.PREFERENCE_EMAIL_DAILY_CAP ?? 100)))) {
    console.error("Preference email suppressed by durable send limit or counter failure.");
    return generic();
  }
  const token = preferenceToken();
  await db().collection("preferenceTokens").doc(preferenceHash(token)).set({ email, contactId: contact.id, createdAt: Date.now(), expiresAt: Date.now() + LINK_TTL_MS });
  const base = siteUrl.replace(/\/$/, "");
  const href = `${base}/preferences#token=${token}`;
  try {
    const sent = await new Resend(key).emails.send({
      from, to: email, subject: "Manage your AI Discussion Club preferences",
      html: `<div style="font-family:Arial,sans-serif;color:#271d31;line-height:1.6;max-width:560px;margin:auto"><h1 style="font-family:Georgia,serif;font-weight:500">Your preferences</h1><p>Use this private link within one hour to choose club email and event directory settings.</p><p><a href="${href}" style="display:inline-block;background:#6441a5;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">Manage preferences</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
    });
    if (sent.error || !sent.data?.id) throw new Error("Resend did not accept the message.");
  } catch {
    console.error("Preference email provider did not accept a message.");
    return generic();
  }
  return generic();
}
