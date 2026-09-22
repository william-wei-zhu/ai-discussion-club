import type { ProfileLink, Social } from "@/lib/types";

export const SOCIAL_KEYS = ["x", "github", "website", "calendar", "other"] as const;

export function normalizeUrl(raw: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, "")}`;
  return /\./.test(normalized) ? normalized.slice(0, 200) : "";
}

export function cleanSocial(input: unknown): Social {
  const raw = (input ?? {}) as Record<string, unknown>;
  const out: Social = {};
  for (const key of SOCIAL_KEYS) {
    const value = normalizeUrl(String(raw[key] ?? ""));
    if (value) out[key] = value;
  }
  return out;
}

export function mapLinksToSocial(links?: ProfileLink[]): Social {
  const out: Social = {};
  for (const link of links ?? []) {
    const url = normalizeUrl(link?.url ?? "");
    if (!url) continue;
    const lower = url.toLowerCase();
    if (/linkedin\.com/.test(lower)) continue;
    if (/github\.com/.test(lower)) out.github ??= url;
    else if (/(x\.com|twitter\.com)/.test(lower)) out.x ??= url;
    else out.website ??= url;
  }
  return out;
}
