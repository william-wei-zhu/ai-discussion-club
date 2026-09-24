// The "Connect with fellow participants" email, sent when an event ends. Pure
// helpers only (no firebase-admin), so the timing and recipient rules are unit
// tested and shared by the cron and lib/club.

// How long after the end the email may still go out. Past this, a late "thanks for
// coming" reads as spam, so the cron records a miss instead of sending.
export const CONNECT_WINDOW_MS = 24 * 60 * 60 * 1000;
// When Luma gives no end time, assume a two-hour event.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

export function eventEndMs(event: { startAt: number; endAtIso?: string }): number {
  const end = event.endAtIso ? Date.parse(event.endAtIso) : NaN;
  return Number.isFinite(end) && end > event.startAt ? end : event.startAt + DEFAULT_DURATION_MS;
}

export type ConnectTiming = "not-yet" | "due" | "missed";

export function connectTiming(event: { startAt: number; endAtIso?: string }, now: number): ConnectTiming {
  const end = eventEndMs(event);
  if (now < end) return "not-yet";
  return now < end + CONNECT_WINDOW_MS ? "due" : "missed";
}

export interface ConnectGuest {
  id: string;
  name: string;
  email: string;
  approvalStatus: string;
  isHost?: boolean;
}

// Everyone who was going (approved) plus hosts, minus anyone who unsubscribed or
// bounced, one email per address (Luma account merges can share an address).
export function connectRecipients<G extends ConnectGuest>(
  guests: G[],
  suppressed: (id: string) => boolean,
): G[] {
  const seen = new Set<string>();
  const out: G[] = [];
  for (const g of guests) {
    if (g.approvalStatus !== "approved" && !g.isHost) continue;
    const email = (g.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email) || suppressed(g.id)) continue;
    seen.add(email);
    out.push(g);
  }
  return out;
}
