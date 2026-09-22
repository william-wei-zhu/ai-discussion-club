import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { DIRECTORY_ACCESS, hashToken, isDirectoryToken } from "@/lib/directory";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
};

function directoryNotFound() {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>Page not found | AI Discussion Club</title><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#fbf8f2;color:#271d31;font-family:Arial,sans-serif}.card{width:min(620px,100%);padding:48px 32px;text-align:center;border:1px solid #d9cfe1;border-radius:18px;background:#eee8f6}img{width:82px;height:82px;border-radius:50%}h1{margin:20px 0 12px;font:500 clamp(2.7rem,8vw,4.6rem)/1 Georgia,serif}p{margin:0 auto 24px;max-width:32rem;line-height:1.7}a{display:inline-flex;min-height:48px;align-items:center;padding:10px 24px;border-radius:999px;background:#6441a5;color:#fff;text-decoration:none;font-weight:600}@media(prefers-color-scheme:dark){body{background:#201a29;color:#fcf7ff}.card{background:#30263d;border-color:#63536f}}</style></head><body><main class="card"><img src="/brand/logo.png" alt=""><h1>This page isn’t here.</h1><p>The private link may be invalid, expired, or revoked.</p><a href="/events">Explore events</a></main></body></html>`;
  return new NextResponse(body, {
    status: 404,
    headers: {
      ...privateHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

// Admin event responses can contain attendee names, email addresses, and match
// details. Keep browsers and intermediary caches from retaining any of them.
export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/g/")) {
    const token = req.nextUrl.pathname.slice(3);
    if (!isDirectoryToken(token)) return directoryNotFound();
    try {
      const access = await db().collection(DIRECTORY_ACCESS).where("tokenHash", "==", hashToken(token)).limit(1).get();
      const record = access.docs[0];
      if (!record || record.data().enabled !== true) return directoryNotFound();
      const event = await db().collection("clubEvents").doc(record.id).get();
      if (!event.exists) return directoryNotFound();
    } catch {
      return directoryNotFound();
    }
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", privateHeaders["Cache-Control"]);
  response.headers.set("Pragma", privateHeaders.Pragma);
  if (req.nextUrl.pathname.startsWith("/g/")) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export const config = {
  matcher: ["/api/events/:path*", "/g/:token"],
};
