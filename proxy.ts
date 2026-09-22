import { NextResponse } from "next/server";

// Admin event responses can contain attendee names, email addresses, and match
// details. Keep browsers and intermediary caches from retaining any of them.
export function proxy() {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export const config = {
  matcher: ["/api/events/:path*"],
};
