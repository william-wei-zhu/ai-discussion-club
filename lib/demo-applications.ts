import { normalizeEmail } from "@/lib/email";

// Demo night applications: visitors apply at /demo to show a project at a future
// builder demo night. One general pool, not tied to a Luma event. Stored in the
// top-level `demoApplications` collection, read and reviewed only in /admin.

export const DEMO_APPLICATIONS = "demoApplications";

export const DEMO_STATUSES = ["new", "shortlisted", "accepted", "declined"] as const;
export type DemoStatus = (typeof DEMO_STATUSES)[number];

export const ADMIN_NOTE_MAX = 2000;

export interface DemoApplicationInput {
  name: string;
  email: string;
  description: string;
  projectUrl: string;
  linkedinUrl: string;
  company: string;
}

export interface DemoApplication extends DemoApplicationInput {
  id: string;
  status: DemoStatus;
  adminNote: string;
  createdAt: number;
  updatedAt: number;
}

export type DemoField = keyof DemoApplicationInput;

const LIMITS = { name: 120, description: 1500, company: 120, url: 500 } as const;
export const DESCRIPTION_MIN = 20;

export function isDemoStatus(v: unknown): v is DemoStatus {
  return typeof v === "string" && (DEMO_STATUSES as readonly string[]).includes(v);
}

/** An http(s) URL, with `https://` added when the scheme is missing. Null if unusable. */
export function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > LIMITS.url || /\s/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** True for linkedin.com or any subdomain of it, never a look-alike host. */
export function isLinkedInUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "linkedin.com" || host.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

// Single-line fields: collapse any whitespace run (including newlines) to one space.
function line(raw: unknown): string {
  return text(raw).replace(/\s+/g, " ");
}

export function validateDemoApplication(
  body: unknown,
): { ok: true; value: DemoApplicationInput } | { ok: false; errors: Partial<Record<DemoField, string>> } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: Partial<Record<DemoField, string>> = {};

  const name = line(b.name);
  if (!name) errors.name = "Enter your full name.";
  else if (name.length > LIMITS.name) errors.name = `Keep your name under ${LIMITS.name} characters.`;

  const email = normalizeEmail(b.email);
  if (!email) errors.email = "Enter a valid email address.";

  const description = text(b.description);
  if (!description) errors.description = "Tell us about the project you want to show.";
  else if (description.length < DESCRIPTION_MIN) errors.description = "Add a little more detail, two to four sentences is ideal.";
  else if (description.length > LIMITS.description) errors.description = `Keep the description under ${LIMITS.description} characters.`;

  const projectUrl = normalizeUrl(b.projectUrl);
  if (!projectUrl) errors.projectUrl = "Enter a valid link to your project.";

  const linkedinUrl = normalizeUrl(b.linkedinUrl);
  if (!linkedinUrl || !isLinkedInUrl(linkedinUrl)) errors.linkedinUrl = "Enter your LinkedIn profile link.";

  const company = line(b.company);
  if (company.length > LIMITS.company) errors.company = `Keep this under ${LIMITS.company} characters.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email: email!, description, projectUrl: projectUrl!, linkedinUrl: linkedinUrl!, company } };
}

// A cell a spreadsheet would read as a formula is prefixed with a quote, so an
// applicant cannot plant `=HYPERLINK(...)` or similar in the admin's export.
function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function demoApplicationsCsv(rows: DemoApplication[]): string {
  const header = ["Submitted", "Status", "Name", "Email", "Company", "Project URL", "LinkedIn", "Description", "Admin note"];
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      r.status,
      r.name,
      r.email,
      r.company,
      r.projectUrl,
      r.linkedinUrl,
      r.description,
      r.adminNote,
    ].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
