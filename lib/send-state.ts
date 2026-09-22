// Pure send-state helpers, kept free of any server-only import (no firebase-admin,
// no resend) so both the admin CLIENT UI and the server can share ONE source of
// truth for "is this event going to send, and what should we call its state".
// `lib/club.ts` re-exports these for server callers. The input is a minimal
// structural shape so both the server's ClubEvent and the UI's looser row type fit.

export interface SendStateInput {
  autoSend?: boolean;
  cancelled?: boolean;
  cancelledAt?: number;
  cancelledBy?: string;
  send?: { completedAt?: number; sent?: number };
}

/**
 * Whether this event WILL send automatically at T-24h — the single on/off the admin
 * UI shows. `autoSend` is the arm; `cancelled` is a pause that overrides it (kept
 * separate so a pause preserves the arm and a resume restores auto-sending in one
 * click). The cron enforces the same precedence: it checks `cancelled` before
 * `isArmed`, so "cancelled + armed" never sends and must never read as "on".
 */
export function willSendAutomatically(event: Pick<SendStateInput, "autoSend" | "cancelled">): boolean {
  return !!event.autoSend && !event.cancelled;
}

export type SendStateKind = "sent" | "sending" | "stopped" | "scheduled" | "off";

export interface SendState {
  kind: SendStateKind;
  label: string;
  /** Present only for "stopped": who/when the pause was set, for the audit line. */
  by?: string;
  at?: number;
}

/**
 * The one coherent send status for an event, so the badge, the toggle, and the prose
 * line can never disagree. Precedence is top-down and mirrors the cron's own order,
 * which is why `stopped` (cancelled) beats `scheduled` (armed): a cancelled event
 * never sends, whatever `autoSend` says.
 */
export function describeSendState(event: SendStateInput): SendState {
  const send = event.send;
  if (send?.completedAt) return { kind: "sent", label: "All emails sent" };
  if (send?.sent) return { kind: "sending", label: "Sending now" };
  if (event.cancelled) {
    return { kind: "stopped", label: "Emails stopped", by: event.cancelledBy, at: event.cancelledAt };
  }
  if (event.autoSend) return { kind: "scheduled", label: "Sends 24h before the event" };
  return { kind: "off", label: "Automatic sending is off" };
}
