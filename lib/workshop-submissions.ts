import { normalizeUrl } from "@/lib/demo-applications";
import { WORKSHOPS } from "@/lib/workshops";

// Workshop gallery: people who finish a workshop deck add their name and their
// app's link on the finish slide. Stored in the top-level `workshopSubmissions`
// collection and shown publicly on /workshops/submissions straight away; the
// admin "Workshop submissions" tab can hide any entry.

export const WORKSHOP_SUBMISSIONS = "workshopSubmissions";
export const NAME_MAX = 80;
// Read cap for the public gallery and the admin list. Filtering happens in
// memory at this scale; move `hidden == false` into an indexed query past it.
export const SUBMISSIONS_READ_LIMIT = 500;

export interface WorkshopSubmissionInput {
  workshop: string;
  name: string;
  url: string;
}

export interface WorkshopSubmission extends WorkshopSubmissionInput {
  id: string;
  hidden: boolean;
  createdAt: number;
}

export type SubmissionField = "name" | "url";

export function isWorkshopSlug(v: unknown): v is string {
  return typeof v === "string" && WORKSHOPS.some((w) => w.slug === v);
}

export function workshopTitle(slug: string): string {
  return WORKSHOPS.find((w) => w.slug === slug)?.title ?? "Workshop";
}

export function validateWorkshopSubmission(
  body: unknown,
): { ok: true; value: WorkshopSubmissionInput } | { ok: false; error: string; errors: Partial<Record<SubmissionField, string>> } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!isWorkshopSlug(b.workshop)) return { ok: false, error: "Unknown workshop.", errors: {} };
  const errors: Partial<Record<SubmissionField, string>> = {};

  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (!name) errors.name = "Enter your name.";
  else if (name.length > NAME_MAX) errors.name = `Keep your name under ${NAME_MAX} characters.`;

  const url = normalizeUrl(b.url);
  if (!url) errors.url = "Enter your app's web address, like your-app.vercel.app.";

  if (Object.keys(errors).length) return { ok: false, error: "Check the highlighted fields.", errors };
  return { ok: true, value: { workshop: b.workshop, name, url: url! } };
}

export function toSubmission(id: string, x: Record<string, unknown>): WorkshopSubmission {
  return {
    id,
    workshop: String(x.workshop ?? ""),
    name: String(x.name ?? ""),
    url: String(x.url ?? ""),
    hidden: x.hidden === true,
    createdAt: Number(x.createdAt ?? 0),
  };
}

/** The host a visitor will land on, without `www.`, for display next to the name. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
