export type CalendarSyncGate = "unauthorized" | "jobs-disabled" | "luma-not-configured" | "ready";

export function calendarSyncGate(input: {
  authorization: string | null;
  secret: string | undefined;
  jobsEnabled: boolean;
  lumaConfigured: boolean;
}): CalendarSyncGate {
  if (!input.secret || input.authorization !== `Bearer ${input.secret}`) return "unauthorized";
  if (!input.jobsEnabled) return "jobs-disabled";
  if (!input.lumaConfigured) return "luma-not-configured";
  return "ready";
}
