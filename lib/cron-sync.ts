import { timingSafeEqual } from "crypto";

/** Constant-time `Bearer <secret>` check. Fails closed when the secret is unset. */
export function bearerMatches(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const a = Buffer.from(authorization);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type CalendarSyncGate = "unauthorized" | "jobs-disabled" | "luma-not-configured" | "ready";

export function calendarSyncGate(input: {
  authorization: string | null;
  secret: string | undefined;
  jobsEnabled: boolean;
  lumaConfigured: boolean;
}): CalendarSyncGate {
  if (!bearerMatches(input.authorization, input.secret)) return "unauthorized";
  if (!input.jobsEnabled) return "jobs-disabled";
  if (!input.lumaConfigured) return "luma-not-configured";
  return "ready";
}
