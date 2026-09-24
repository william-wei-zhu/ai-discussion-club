import { after, NextResponse } from "next/server";
import { clientIp, rateLimit, spendBudget } from "@/lib/guard";
import { requestOriginAllowed } from "@/lib/preferences";
import { db } from "@/lib/firebase-admin";
import { DEMO_APPLICATIONS, validateDemoApplication } from "@/lib/demo-applications";
import { sendDemoApplicationAdminNotice, sendDemoApplicationConfirmation } from "@/lib/resend";

// POST /api/demo-applications: the public /demo form. Stores the application, then
// emails the applicant and the organizer after the response. An email failure is
// logged and never fails a stored application.
const noStore = { "Cache-Control": "private, no-store" };

export async function POST(req: Request) {
  if (!requestOriginAllowed(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: noStore });
  const ip = clientIp(req);
  const tooMany = () => NextResponse.json({ error: "Too many applications from this network. Try again in an hour." }, { status: 429, headers: noStore });
  // Loose cap on every attempt, so fixing a typo a few times never locks anyone out;
  // the strict cap below counts only valid applications.
  if (!rateLimit(ip, "demo-apply-attempt", 30, 60 * 60 * 1000)) return tooMany();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  // Honeypot: a hidden field only bots fill in. Look successful, store nothing.
  if (typeof body?.website === "string" && body.website.trim()) return NextResponse.json({ ok: true }, { headers: noStore });

  const parsed = validateDemoApplication(body);
  if (!parsed.ok) return NextResponse.json({ error: "Check the highlighted fields.", errors: parsed.errors }, { status: 400, headers: noStore });
  if (!rateLimit(ip, "demo-apply", 5, 60 * 60 * 1000)) return tooMany();

  if (!(await spendBudget("demo-apply", Number(process.env.DEMO_APPLICATION_DAILY_CAP ?? 200)))) {
    return NextResponse.json({ error: "We are receiving a lot of applications right now. Try again tomorrow." }, { status: 429, headers: noStore });
  }

  const now = Date.now();
  await db().collection(DEMO_APPLICATIONS).add({ ...parsed.value, status: "new", adminNote: "", createdAt: now, updatedAt: now });

  if (process.env.EMAIL_SENDING_ENABLED === "true") {
    after(async () => {
      const results = await Promise.allSettled([
        sendDemoApplicationConfirmation(parsed.value),
        sendDemoApplicationAdminNotice(parsed.value),
      ]);
      results.forEach((r, i) => {
        if (r.status === "rejected") console.error(`Demo application ${i === 0 ? "confirmation" : "admin notice"} email failed.`, (r.reason as Error)?.message);
      });
    });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
