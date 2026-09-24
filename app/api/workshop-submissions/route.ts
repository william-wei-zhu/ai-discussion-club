import { NextResponse } from "next/server";
import { clientIp, rateLimit, spendBudget } from "@/lib/guard";
import { requestOriginAllowed } from "@/lib/preferences";
import { db } from "@/lib/firebase-admin";
import { WORKSHOP_SUBMISSIONS, validateWorkshopSubmission } from "@/lib/workshop-submissions";

// POST /api/workshop-submissions: the form on a workshop deck's finish slide.
// Goes live in the public gallery at once; the admin tab can hide it.
const noStore = { "Cache-Control": "private, no-store" };

export async function POST(req: Request) {
  if (!requestOriginAllowed(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: noStore });
  const ip = clientIp(req);
  const tooMany = () => NextResponse.json({ error: "Too many submissions from this network. Try again in an hour." }, { status: 429, headers: noStore });
  // Loose cap on every attempt so fixing a typo never locks anyone out. The
  // valid-submission cap is higher than /demo's because a whole workshop room
  // shares one network.
  if (!rateLimit(ip, "workshop-submit-attempt", 60, 60 * 60 * 1000)) return tooMany();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  // Honeypot: a hidden field only bots fill in. Look successful, store nothing.
  if (typeof body?.website === "string" && body.website.trim()) return NextResponse.json({ ok: true }, { headers: noStore });

  const parsed = validateWorkshopSubmission(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, errors: parsed.errors }, { status: 400, headers: noStore });
  if (!rateLimit(ip, "workshop-submit", 40, 60 * 60 * 1000)) return tooMany();
  if (!(await spendBudget("workshop-submit", Number(process.env.WORKSHOP_SUBMISSION_DAILY_CAP ?? 300)))) {
    return NextResponse.json({ error: "The gallery is very busy right now. Try again tomorrow." }, { status: 429, headers: noStore });
  }

  await db().collection(WORKSHOP_SUBMISSIONS).add({ ...parsed.value, hidden: false, createdAt: Date.now() });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
