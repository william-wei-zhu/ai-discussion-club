import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyClubUnsubscribeToken } from "@/lib/unsubscribe";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

// One-click unsubscribe from the AI Discussion Club pre-event emails (RFC 8058).
//
// A SEPARATE route from /api/unsubscribe on purpose. That one flips a SuperIntro
// member's notifyWeekly; this one flips clubContacts.emailOptOut for a Luma contact.
// Different subject space (Luma user_api_id, not a member uid) and different token
// prefix ("club:" vs "weekly:"), so a token captured from one list can never opt
// someone out of the other, and a bug here cannot touch a member's digest settings.
//
// - POST: the one-click path Gmail/Yahoo hit automatically from the header.
// - GET:  the fallback when a human clicks the visible link.
async function unsubscribe(token: string): Promise<boolean> {
  const lumaUserId = verifyClubUnsubscribeToken(token);
  if (!lumaUserId) return false;
  const ref = db().collection("clubContacts").doc(lumaUserId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  // Idempotent. Opting out removes them as a recipient AND as someone we recommend,
  // which is the honest reading of "leave me out of this".
  await ref.set({ emailOptOut: true, optOutAt: Date.now() }, { merge: true });
  return true;
}

function tokenFrom(req: Request): string {
  return new URL(req.url).searchParams.get("t")?.trim() ?? "";
}

export async function POST(req: Request) {
  // RFC 8058: a 2xx is all the client needs.
  await unsubscribe(tokenFrom(req)).catch(() => false);
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request) {
  const ok = await unsubscribe(tokenFrom(req)).catch(() => false);
  const message = ok
    ? "You're unsubscribed. You won't get any more pre-event emails from the AI Discussion Club. You'll still get Luma's own event emails."
    : "This unsubscribe link is invalid or expired. Reply to the email and William will take you off the list.";
  // Static confirmation page; no user input is reflected.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Discussion Club email preferences</title></head><body style="font-family:ui-sans-serif,system-ui,sans-serif;background:#f7f4ef;color:#2a211c;margin:0"><div style="max-width:480px;margin:12vh auto;padding:0 24px;text-align:center"><h1 style="font-size:22px;margin:0 0 12px">AI Discussion Club</h1><p style="font-size:16px;line-height:1.6">${message}</p><p style="margin-top:24px"><a href="${siteUrl}" style="color:#6d35a8;font-weight:600">AI Discussion Club</a></p></div></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
