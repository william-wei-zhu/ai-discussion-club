import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { getContacts } from "@/lib/club";
import { profileView } from "@/lib/profile-rules";

// GET /api/events/contacts?q=&tag=&limit=&page= — the club CRM roster, paged.
//
// Reads clubContacts only, never the signal subcollection, so the 768-dim
// embeddings cannot leak into a response (contrast /api/admin/leads, which has to
// hand-strip needEmbedding/offerEmbedding from the same doc).
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const res = await getContacts({
    q: url.searchParams.get("q") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    limit: Number.isFinite(limitRaw) ? limitRaw : 20,
    page: Number.isFinite(pageRaw) ? pageRaw : 1,
  });
  // Only what the roster shows. Full docs carried the recommendation-history maps
  // for every row, which the UI never used.
  return NextResponse.json({
    ...res,
    contacts: res.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      eventApprovedCount: c.eventApprovedCount,
      eventCheckedInCount: c.eventCheckedInCount,
      firstSeenAt: c.firstSeenAt,
      emailOptOut: !!c.emailOptOut,
      emailBouncedAt: c.emailBouncedAt,
      linkedinCandidate: c.linkedinCandidate,
      profile: profileView(c),
    })),
  });
}
