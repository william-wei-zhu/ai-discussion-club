import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/guard";
import { db } from "@/lib/firebase-admin";
import { DEMO_APPLICATIONS, isDemoStatus, type DemoApplication } from "@/lib/demo-applications";

// GET /api/events/demo-applications: every demo night application, newest first,
// for the admin "Demo applications" tab (which filters and exports client side).
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientIp(req), "club", 120)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }
  const snap = await db().collection(DEMO_APPLICATIONS).orderBy("createdAt", "desc").limit(1000).get();
  const applications: DemoApplication[] = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      name: String(x.name ?? ""),
      email: String(x.email ?? ""),
      description: String(x.description ?? ""),
      projectUrl: String(x.projectUrl ?? ""),
      linkedinUrl: String(x.linkedinUrl ?? ""),
      company: String(x.company ?? ""),
      status: isDemoStatus(x.status) ? x.status : "new",
      adminNote: String(x.adminNote ?? ""),
      createdAt: Number(x.createdAt ?? 0),
      updatedAt: Number(x.updatedAt ?? 0),
    };
  });
  return NextResponse.json({ applications });
}
