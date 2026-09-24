"use client";

import Image from "next/image";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DirectoryControl } from "@/components/directory-control";
import { ProfileAvatar, ProfileEditor, type Candidate } from "@/components/profile-editor";
import type { ProfileView } from "@/lib/profile-rules";
import { willSendAutomatically, describeSendState } from "@/lib/send-state";
import type { DirectoryStatus } from "@/lib/directory";
import {
  PW_KEY,
  Gate,
  ConfirmDialog,
  useAuthFetch,
  useLoad,
  Section,
  fmtDate,
  fmtTime,
  type Confirm,
  type Fetcher,
} from "@/components/admin-shell";

// The private AI Discussion Club console. Reads Firestore only (the Luma mirror);
// the single button that talks to Luma is Sync.

export function EventsClient() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"events" | "subscribers">("events");
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const authFetch = useAuthFetch(user, () => setAuthed(false));

  useEffect(() => {
    if (user && sessionStorage.getItem(PW_KEY)) setAuthed(true);
  }, [user]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!user || !authed)
    return (
      <Gate
        title="AI Discussion Club"
        validatePath="/api/events/summary"
        user={user}
        signInWithGoogle={signInWithGoogle}
        pw={pw}
        setPw={setPw}
        onAuthed={() => setAuthed(true)}
      />
    );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">AI Discussion Club</h1>
        <button
          className="rounded-lg border px-3 py-1.5 text-sm"
          onClick={() => {
            sessionStorage.removeItem(PW_KEY);
            setAuthed(false);
          }}
        >
          Lock
        </button>
      </div>

      {/* Segmented tab bar (no shadcn Tabs component; mirror the app's pill idiom). */}
      <div role="tablist" aria-label="Console sections" className="mt-5 flex flex-wrap gap-1 rounded-xl border p-1">
        {([
          { key: "events", label: "Events" },
          { key: "subscribers", label: "Subscribers" },
        ] as const).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "events" && (
          <>
            <Events authFetch={authFetch} selected={selected} onSelect={setSelected} ask={setConfirm} />
            {selected && <GuestTable authFetch={authFetch} eventId={selected} />}
          </>
        )}
        {tab === "subscribers" && <Roster authFetch={authFetch} ask={setConfirm} />}
      </div>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

// --- Events ----------------------------------------------------------------

interface EventRow {
  coverUrl?: string;
  id: string;
  name: string;
  startAt: number;
  timezone?: string;
  url?: string;
  address?: string;
  hoursUntil: number;
  counts: { total: number; approved: number; invited: number; declined: number; checkedIn: number };
  guestsSyncedAt?: number;
  autoSend?: boolean;
  cancelled?: boolean;
  cancelledAt?: number;
  cancelledBy?: string;
  autoSendArmedBy?: string;
  prepare?: { completedAt?: number; recipients?: number; zeroSignal?: number; error?: string };
  previewEmailedAt?: number;
  send?: { completedAt?: number; sent: number; skipped: number; failed: number };
  connect?: { completedAt?: number; sent: number; skipped: number; failed: number; error?: string };
  registrationQuestions?: { id: string; label: string; questionType: string }[];
  /** Attendees who have never had a profile lookup. Upcoming events only. */
  pendingLookup?: number;
  directory?: DirectoryStatus;
}

// The event's local start, in the event's own timezone (a DC event reads as 3:00 PM
// EDT even when the browser is elsewhere).
function eventWhen(e: Pick<EventRow, "startAt" | "timezone">): string {
  if (!e.startAt) return "Not available";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: e.timezone || "UTC",
    }).format(new Date(e.startAt));
  } catch {
    return new Date(e.startAt).toLocaleString();
  }
}

function Events({
  authFetch,
  selected,
  onSelect,
  ask,
}: {
  authFetch: Fetcher;
  selected: string | null;
  onSelect: (id: string) => void;
  ask: (c: Confirm) => void;
}) {
  const { data, err, loading, refreshing, reload } = useLoad<EventList>(() => authFetch("/api/events/list") as Promise<EventList>);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  async function syncCalendar() {
    setBusy("calendar");
    setMsg(null);
    try {
      const r = (await authFetch("/api/events/sync", { method: "POST", body: "{}" })) as {
        events?: { events: number; created: number };
        contacts?: { contacts: number; created: number };
      };
      setMsg(`Synced ${r.events?.events ?? 0} events and ${r.contacts?.contacts ?? 0} subscribers (${r.contacts?.created ?? 0} new).`);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="mt-8 text-muted-foreground">Loading events…</p>;
  if (err && !data) return <p className="note mt-8 text-sm">{err} <Button variant="outline" size="sm" onClick={reload}>Try again</Button></p>;

  const all = data?.events ?? [];
  const upcoming = all.filter((e) => e.hoursUntil > 0).sort((a, b) => a.startAt - b.startAt);
  const past = all.filter((e) => e.hoursUntil <= 0);

  return (
    <Section title="Events">
      {data?.setup && (
        <div className="mb-4 rounded-xl border p-3 text-sm">
          <p className="font-semibold">Integration status</p>
          <p className="mt-1 text-muted-foreground">
            Luma {data.setup.luma ? "ready" : "needs setup"} · Gemini {data.setup.gemini ? "ready" : "needs setup"} · Exa {data.setup.exa ? "ready" : "needs setup"} · Email {data.setup.resend ? "provider ready" : "needs setup"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Background jobs {data.setup.jobsEnabled ? "enabled" : "paused"} · attendee email {data.setup.emailSendingEnabled ? "enabled" : "paused"}
          </p>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Matches are worked out 48 hours before each event and you get a preview. 24 hours before, every confirmed guest
        gets one email with 5 people to meet. When the event ends, they get the private directory. New events send
        automatically; you can stop any event&apos;s emails until they go out.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={syncCalendar} disabled={busy === "calendar"}>
          {busy === "calendar" ? "Syncing…" : "Sync calendar from Luma"}
        </Button>
        {past.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowPast((v) => !v)}>
            {showPast ? "Hide past events" : `Show ${past.length} past events`}
          </Button>
        )}
        {refreshing && <span className="text-xs text-muted-foreground" role="status">Refreshing…</span>}
      </div>
      {msg && <p className="note mt-2 text-sm">{msg}</p>}
      {err && <p className="note mt-2 text-sm">Could not refresh: {err}</p>}

      <div className="mt-3 space-y-3">
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming events on the calendar. Create one on Luma, then sync.</p>}
        {[...upcoming, ...(showPast ? past : [])].map((e) => (
          <EventCard
            key={e.id}
            event={e}
            selected={selected === e.id}
            onSelect={() => onSelect(e.id)}
            authFetch={authFetch}
            ask={ask}
            reload={reload}
          />
        ))}
      </div>
    </Section>
  );
}

type EventList = {
  events: EventRow[];
  setup: { luma: boolean; gemini: boolean; exa: boolean; resend: boolean; jobsEnabled: boolean; emailSendingEnabled: boolean };
};

// The connect email goes out at the end of the event, so its stop switch has to
// outlive the start time. After a few days nothing is pending any more.
const CONNECT_WINDOW_H = 72;

function EventCard({
  event: e,
  selected,
  onSelect,
  authFetch,
  ask,
  reload,
}: {
  event: EventRow;
  selected: boolean;
  onSelect: () => void;
  authFetch: Fetcher;
  ask: (c: Confirm) => void;
  reload: () => void;
}) {
  const upcoming = e.hoursUntil > 0;
  // One constant for the request and the label, so the button can never advertise a
  // number it does not act on.
  const LOOKUP_BATCH = 25;
  const pending = e.pendingLookup ?? 0;
  const thisBatch = Math.min(pending, LOOKUP_BATCH);
  // Attendees who confirmed after the matches were computed, so are not in them.
  const staleBy = e.prepare?.completedAt
    ? Math.max(0, (e.counts?.approved ?? 0) - (e.prepare.recipients ?? 0))
    : 0;
  // One coherent send-state, shared by the status pill, the toggle, and the prose
  // line below, so they can never contradict (the "cancelled + on at once" bug).
  const send = describeSendState(e);
  const willSend = willSendAutomatically(e);
  // Anything still to send? The pre-event email until it has gone, then the connect
  // email until it has gone (or the event is long over).
  const emailsPending = upcoming ? !e.connect?.completedAt : e.hoursUntil > -CONNECT_WINDOW_H && !e.connect?.completedAt;
  const [acting, setActing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Long actions (prepare, enrich) report their own outcome inline rather than
  // silently finishing: these spend money and change what ~100 people receive. The
  // list refresh runs in the background, so this note stays on screen.
  async function act(key: string, run: () => Promise<string>) {
    setActing(key);
    setNote(null);
    try {
      setNote(await run());
      reload();
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setActing(null);
    }
  }

  async function syncGuests() {
    await act("sync", async () => {
      const r = (await authFetch("/api/events/sync", { method: "POST", body: JSON.stringify({ eventId: e.id }) })) as {
        guests?: number; counts?: { approved: number }; linkedinPromoted?: number;
      };
      return `Synced ${r.guests ?? 0} registrations (${r.counts?.approved ?? 0} confirmed)` +
        (r.linkedinPromoted ? `, ${r.linkedinPromoted} LinkedIn links from registration answers.` : ".");
    });
  }

  // The participant roster export. It neither spends money nor changes state, so it
  // does not reload. The server returns the .xlsx base64-encoded inside JSON
  // (authFetch parses JSON), decoded here into a Blob download.
  async function downloadParticipants() {
    setActing("download");
    setNote(null);
    try {
      const r = (await authFetch(`/api/events/${e.id}/participants-xlsx`)) as { xlsx: string; filename: string; count: number };
      const bytes = Uint8Array.from(atob(r.xlsx), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking synchronously can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      if (r.count === 0) setNote("No confirmed guests yet, so the sheet is empty.");
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setActing(null);
    }
  }

  const prepare = () => ask({
    title: e.prepare?.completedAt ? "Work out matches for new guests?" : "Work out the matches now?",
    description: `Syncs registrations, then matches ${e.counts?.approved ?? 0} confirmed guests (uses AI credits) and emails you a preview. Guests already emailed are never changed.`,
    confirmLabel: "Work out matches",
    run: () => act("prepare", async () => {
      const r = (await authFetch(`/api/events/${e.id}/prepare`, { method: "POST", body: JSON.stringify({ force: false }) })) as {
        recipients?: number; zeroSignal?: number; done?: boolean; remaining?: number; previewSent?: boolean;
      };
      return `Matched ${r.recipients ?? 0} guests${r.zeroSignal ? `, ${r.zeroSignal} of whom we know nothing about` : ""}` +
        (r.done ? "" : `, ${r.remaining} left for the next run`) +
        (r.previewSent ? ". Preview emailed to you." : ".");
    }),
  });

  const lookup = () => ask({
    title: `Look up ${thisBatch} ${thisBatch === 1 ? "profile" : "profiles"}?`,
    description: "Searches LinkedIn for guests we know nothing about (uses Exa and AI credits, within the daily caps). People who set their own LinkedIn are never searched.",
    confirmLabel: "Look up profiles",
    run: () => act("enrich", async () => {
      const r = (await authFetch("/api/events/enrich", { method: "POST", body: JSON.stringify({ eventId: e.id, limit: LOOKUP_BATCH }) })) as {
        considered?: number; signalsBuilt?: number; confirmed?: number; photos?: number;
      };
      return `Looked up ${r.considered ?? 0} guests: ${r.confirmed ?? 0} LinkedIn profiles found, ${r.photos ?? 0} photos, ${r.signalsBuilt ?? 0} now matchable.`;
    }),
  });

  const connectTest = () => ask({
    title: "Send yourself the connect email?",
    description: e.directory?.enabled
      ? "Sends the end-of-event email to your admin address, marked [test], using the current directory link."
      : "Sends the end-of-event email to your admin address, marked [test]. This event has no directory link yet, so one will be created.",
    confirmLabel: "Send test",
    run: () => act("connect-test", async () => {
      await authFetch(`/api/events/${e.id}/connect-test`, { method: "POST" });
      return "Connect email sent to your admin address, marked [test].";
    }),
  });

  const toggleSending = () => ask({
    title: willSend ? "Stop this event's emails?" : e.cancelled ? "Resume this event's emails?" : "Turn on automatic emails?",
    description: willSend
      ? upcoming
        ? `Neither the people-to-meet email (${e.prepare?.recipients ?? e.counts?.approved ?? 0} people) nor the connect email after the event will go out. You can resume any time before they send.`
        : "The connect email after the event will not go out. You can resume while it is still pending."
      : upcoming
        ? `Every confirmed guest (${e.counts?.approved ?? 0} right now) gets the people-to-meet email 24 hours before, and the connect email when the event ends.`
        : "The connect email with the directory link will go out to everyone who attended.",
    confirmLabel: willSend ? "Stop the emails" : e.cancelled ? "Resume sending" : "Turn on",
    danger: willSend,
    run: async () => {
      // Off = pause only (keep the arm). On = clear the pause and arm.
      await authFetch(`/api/events/${e.id}/cancel`, {
        method: "POST",
        body: JSON.stringify(willSend ? { cancelled: true } : { cancelled: false, autoSend: true }),
      });
      reload();
    },
  });

  return (
    <div className={`orbit-card p-4 ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="flex flex-wrap items-start gap-4">
        {e.coverUrl && <Image src={e.coverUrl} alt="" width={96} height={96} sizes="96px" className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{e.name || e.id}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {eventWhen(e)}
                {e.address ? ` · ${e.address}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {upcoming && <Badge>{e.hoursUntil < 48 ? `in ${Math.round(e.hoursUntil)}h` : `in ${Math.round(e.hoursUntil / 24)} days`}</Badge>}
              {e.prepare?.completedAt && <Badge variant="secondary">matched</Badge>}
              {/* One derived send-state badge, so "stopped" and "on" can never both show. */}
              {(upcoming || emailsPending || send.kind === "sent" || send.kind === "sending") && (
                <Badge variant={send.kind === "stopped" ? "destructive" : send.kind === "scheduled" ? "default" : send.kind === "off" ? "outline" : "secondary"}>
                  {send.kind === "stopped" ? "emails stopped" : send.kind === "scheduled" ? "sends automatically" : send.kind === "off" ? "won't send" : send.kind === "sending" ? `sending · ${e.send?.sent ?? 0}` : `sent ${e.send?.sent ?? 0}`}
                </Badge>
              )}
            </div>
          </div>

          <p className="mt-2 text-sm">
            {e.counts?.approved ?? 0} confirmed · {e.counts?.invited ?? 0} invited · {e.counts?.declined ?? 0} declined
            {e.counts?.checkedIn ? ` · ${e.counts.checkedIn} checked in` : ""}
            {" · "}
            <span className="text-muted-foreground">{e.guestsSyncedAt ? `registrations synced ${fmtTime(e.guestsSyncedAt)}` : "registrations never synced"}</span>
          </p>
          {/* The registration questions ARE the matching signal, so surface them. */}
          <p className="mt-1 text-xs text-muted-foreground">
            {e.registrationQuestions?.length
              ? `Asks: ${e.registrationQuestions.map((q) => q.label).filter(Boolean).join(" · ")}`
              : "No registration questions, so no self-described signal."}
          </p>
        </div>
      </div>

      {/* The timeline, stated plainly: matches at T-48h, email at T-24h, connect at the end. */}
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {upcoming && (
          <li>
            {e.prepare?.completedAt
              ? `Matches worked out ${fmtTime(e.prepare.completedAt)} for ${e.prepare.recipients ?? 0} people` +
                (e.prepare.zeroSignal ? `, ${e.prepare.zeroSignal} we know nothing about` : "") +
                (staleBy > 0 ? `. ${staleBy} more confirmed since; work out matches again to include them` : "")
              : e.prepare?.error
                ? `Could not work out matches: ${e.prepare.error}`
                : `Matches get worked out automatically in ${Math.max(0, Math.round(e.hoursUntil - 48))}h (2 days before).`}
            {e.previewEmailedAt ? ` · preview emailed ${fmtTime(e.previewEmailedAt)}` : ""}
          </li>
        )}
        {(upcoming || e.send) && (
          <li>
            {send.kind === "sent"
              ? `People-to-meet email: all ${e.send?.sent ?? 0} sent`
              : send.kind === "sending"
                ? `People-to-meet email: sending now, ${e.send?.sent ?? 0} out so far`
                : send.kind === "stopped"
                  ? `Emails stopped${send.by ? ` by ${send.by}` : ""}${send.at ? ` ${fmtTime(send.at)}` : ""}; nothing will send`
                  : send.kind === "scheduled"
                    ? "People-to-meet email sends 24h before the event"
                    : "Emails are off for this event"}
          </li>
        )}
        {(emailsPending || e.connect) && (
          <li>
            {e.connect?.error
              ? `Connect email: ${e.connect.error}`
              : e.connect?.completedAt
                ? `Connect email sent to ${e.connect.sent} people${e.connect.failed ? `, ${e.connect.failed} failed` : ""}`
                : e.connect
                  ? `Connect email sending now, ${e.connect.sent ?? 0} out so far`
                  : willSend
                    ? e.directory?.enabled === false && e.directory.revokedAt
                      ? "Connect email will not send: the directory is turned off"
                      : "Connect email with the directory link goes out when the event ends"
                    : "Connect email will not send while emails are off"}
          </li>
        )}
      </ul>

      <div className="mt-4 space-y-3 border-t pt-3">
        <ControlRow label="Guests">
          <Button variant={selected ? "default" : "outline"} size="sm" aria-pressed={selected} onClick={onSelect}>
            {selected ? "Showing guests below" : "View guests"}
          </Button>
          <Button variant="outline" size="sm" onClick={syncGuests} disabled={acting !== null}>
            {acting === "sync" ? "Syncing…" : "Sync registrations"}
          </Button>
          {upcoming && (
            <Button variant="outline" size="sm" disabled={acting !== null || pending === 0} onClick={lookup}>
              {acting === "enrich"
                ? "Looking up…"
                : pending === 0
                  ? "All profiles looked up"
                  : thisBatch < pending
                    ? `Look up ${thisBatch} of ${pending} profiles`
                    : `Look up ${pending} ${pending === 1 ? "profile" : "profiles"}`}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={acting !== null} onClick={downloadParticipants}>
            {acting === "download" ? "Preparing…" : "Download participants"}
          </Button>
          {e.url && (
            <a href={e.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-4">
              Open on Luma
            </a>
          )}
        </ControlRow>

        {(upcoming || emailsPending) && (
          <ControlRow label="Emails">
            {!e.send?.completedAt || emailsPending ? (
              <Button
                variant={willSend ? "outline" : "default"}
                size="sm"
                role="switch"
                aria-checked={willSend}
                disabled={acting !== null}
                onClick={toggleSending}
              >
                {willSend ? "Stop emails for this event" : e.cancelled ? "Resume emails" : "Turn on automatic emails"}
              </Button>
            ) : null}
            {upcoming && !e.send?.sent && (
              <Button variant="outline" size="sm" disabled={acting !== null} onClick={prepare}>
                {acting === "prepare" ? "Working out matches…" : e.prepare?.completedAt ? "Match new guests now" : "Work out matches now"}
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={acting !== null} onClick={connectTest}>
              {acting === "connect-test" ? "Sending…" : "Email me the connect email"}
            </Button>
          </ControlRow>
        )}

        <ControlRow label="Directory">
          <DirectoryControl eventId={e.id} initial={e.directory} api={authFetch} ask={ask} />
        </ControlRow>
      </div>
      {note && <p className="note mt-3 text-sm" role="status">{note}</p>}
    </div>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-start">
      <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// --- Guest table -----------------------------------------------------------

interface GuestRow {
  id: string;
  name: string;
  email: string;
  approvalStatus: string;
  registeredAt?: number;
  checkedInAt?: number | null;
  hasAnswers: boolean;
  isHost?: boolean;
  answers: { questionId: string; label: string; answer: string }[];
  signalTier?: string;
  headline?: string;
  linkedinUrl?: string;
  linkedinSource?: string;
  linkedinCandidate?: { url: string; name?: string; headline?: string };
  avatarUrl?: string;
  photoSource?: ProfileView["photoSource"];
  profile?: ProfileView;
  optOut: boolean;
  bouncedAt?: number;
  eventApprovedCount: number;
}

interface Coverage {
  approved: number;
  withAnswers: number;
  withLinkedIn: number;
  zeroSignal: number;
  optedOut: number;
  candidates: number;
  recipients: number;
}

function GuestTable({ authFetch, eventId }: { authFetch: Fetcher; eventId: string }) {
  const load = useCallback(
    () => authFetch(`/api/events/${eventId}/guests`) as Promise<{ guests: GuestRow[]; coverage: Coverage }>,
    [authFetch, eventId],
  );
  const [state, setState] = useState<{ guests: GuestRow[]; coverage: Coverage } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [onlyConfirmed, setOnlyConfirmed] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<GuestRow | null>(null);

  useEffect(() => {
    setState(null);
    setErr(null);
    load()
      .then(setState)
      .catch((e) => setErr((e as Error).message));
  }, [load]);

  if (err) return <p className="note mt-8 text-sm">{err}</p>;
  if (!state) return <p className="mt-8 text-muted-foreground">Loading guests…</p>;

  const c = state.coverage;
  const rows = onlyConfirmed
    ? state.guests.filter((g) => g.approvalStatus === "approved" || g.isHost)
    : state.guests;

  // Apply an edit to the one row, so the table reflects what the server stored.
  function applyEdit(id: string, next: { profile: ProfileView; linkedinCandidate?: Candidate }) {
    setState((prev) => prev && {
      ...prev,
      guests: prev.guests.map((g) => g.id === id ? {
        ...g,
        profile: next.profile,
        linkedinUrl: next.profile.linkedinUrl || undefined,
        linkedinCandidate: next.profile.linkedinUrl ? undefined : next.linkedinCandidate ?? undefined,
      } : g),
    });
  }

  return (
    <Section title="Registrations">
      {/* The honest headline: recommendation quality is capped by how many people
          told us anything. The fix for a thin number is upstream, in the Luma
          registration questions, not in the matcher. */}
      <p className="text-sm">
        {c.approved} confirmed · {c.withAnswers} answered a question ·{" "}
        {c.withLinkedIn} have a LinkedIn · {c.zeroSignal} tell us nothing ·{" "}
        {c.recipients} would be emailed
        {c.optedOut ? ` · ${c.optedOut} opted out` : ""}
        {c.candidates ? ` · ${c.candidates} LinkedIn guesses to review` : ""}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOnlyConfirmed((v) => !v)}>
          {onlyConfirmed ? `Show all ${state.guests.length} registrations` : `Show only ${c.approved} confirmed`}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {onlyConfirmed ? "No confirmed guests yet." : "No registrations yet."} Sync registrations on the event card to pull the latest from Luma.
        </p>
      ) : (
        <div className="orbit-card mt-3 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Guest</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium" title="What we can say about them: their own answers, an enriched LinkedIn, or nothing">Signal</th>
                <th className="px-3 py-2 text-left font-medium">LinkedIn</th>
                <th className="px-3 py-2 text-right font-medium" title="Events they have been approved for, all time">Events</th>
                <th className="px-3 py-2 text-right font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                // Two <tr> per guest (the row plus its expanded detail), so the key
                // belongs on the Fragment, not on the rows.
                <Fragment key={g.id}>
                  <tr className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ProfileAvatar profile={g.profile} name={g.name} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="text-left font-medium underline decoration-border underline-offset-4"
                            aria-expanded={open === g.id}
                            onClick={() => setOpen(open === g.id ? null : g.id)}
                          >
                            {g.name || "(no name)"}
                          </button>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {g.isHost && <Badge variant="secondary">host</Badge>}
                            {g.optOut && <Badge variant="destructive">opted out</Badge>}
                            {g.bouncedAt ? <Badge variant="destructive">bounced</Badge> : null}
                            <span className="text-xs text-muted-foreground">{g.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={g.approvalStatus === "approved" ? "default" : "secondary"}>{g.approvalStatus}</Badge>
                      {g.checkedInAt ? <span className="ml-1 text-xs text-muted-foreground">checked in</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={g.signalTier === "answers" ? "default" : g.signalTier === "linkedin" ? "secondary" : "outline"}>
                        {g.signalTier ?? "none"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {g.linkedinUrl ? (
                          <a href={g.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">profile</a>
                        ) : g.linkedinCandidate ? (
                          <a href={g.linkedinCandidate.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline underline-offset-4">guess to review</a>
                        ) : (
                          <span className="text-xs text-muted-foreground">none</span>
                        )}
                        <Button variant="outline" size="xs" onClick={() => setEditing(g)}>
                          {g.linkedinCandidate && !g.linkedinUrl ? "Review" : "Edit"}
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{g.eventApprovedCount}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmtDate(g.registeredAt)}</td>
                  </tr>
                  {open === g.id && (
                    <tr className="border-b bg-muted/30 last:border-0">
                      <td colSpan={6} className="px-3 py-3">
                        <RecsPanel authFetch={authFetch} eventId={eventId} guestId={g.id} guestName={g.name} confirmed={g.approvalStatus === "approved" || !!g.isHost} />
                        {g.headline && <p className="mt-4 text-sm font-medium">{g.headline}</p>}
                        {g.answers.length ? (
                          <ul className="mt-1 space-y-2">
                            {g.answers.map((a) => (
                              <li key={a.questionId || a.label}>
                                <p className="text-xs text-muted-foreground">{a.label}</p>
                                <p className="text-sm whitespace-pre-wrap">{a.answer}</p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No registration answers. Recommendations for this person fall back to their LinkedIn, or to serendipity.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Select a name to see their five recommendations and what they told you at registration.</p>
      {editing && (
        <ProfileEditor
          contactId={editing.id}
          name={editing.name}
          profile={editing.profile}
          candidate={editing.linkedinUrl ? null : editing.linkedinCandidate}
          authFetch={authFetch}
          onClose={() => setEditing(null)}
          onSaved={(next) => applyEdit(editing.id, next)}
        />
      )}
    </Section>
  );
}

// --- Recs preview ----------------------------------------------------------

interface RecPerson {
  id: string;
  name: string;
  headline?: string;
  why: string;
  linkedinUrl?: string;
  lumaUrl?: string;
  basis: "mutual" | "coverage";
  score: number;
}

// The five this guest would actually receive, plus the one button that proves it:
// send their real email to the admin address. Reading the real thing is the only
// reliable way to catch a bad batch before ~100 people get it.
function RecsPanel({
  authFetch,
  eventId,
  guestId,
  guestName,
  confirmed,
}: {
  authFetch: Fetcher;
  eventId: string;
  guestId: string;
  guestName: string;
  confirmed: boolean;
}) {
  const [rec, setRec] = useState<{ people?: RecPerson[]; lineSource?: string; emailedAt?: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    authFetch(`/api/events/${eventId}/recs?guest=${encodeURIComponent(guestId)}`)
      .then((d) => alive && setRec((d as { rec: typeof rec }).rec))
      .catch((e) => alive && setErr((e as Error).message));
    return () => {
      alive = false;
    };
  }, [authFetch, eventId, guestId]);

  async function sendTest() {
    setBusy(true);
    setSent(null);
    try {
      await authFetch(`/api/events/${eventId}/test-send`, {
        method: "POST",
        body: JSON.stringify({ guestId }),
      });
      setSent("Sent to your admin address, marked [test].");
    } catch (e) {
      setSent((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err) return <p className="note text-sm">{err}</p>;
  if (!rec)
    return (
      <p className="text-sm text-muted-foreground">
        {confirmed
          ? `No recommendations for ${guestName} yet. Use "Work out matches now" on the event card.`
          : `${guestName} is not confirmed, so they get no recommendations.`}
      </p>
    );

  return (
    <div>
      <p className="text-xs text-muted-foreground">
        Their five{rec.lineSource === "gemini" ? ", AI-reasoned" : ", from their own words"}
        {rec.emailedAt ? ` · already emailed ${fmtTime(rec.emailedAt)}` : ""}
      </p>
      <ul className="mt-2 space-y-2">
        {(rec.people ?? []).map((p) => (
          <li key={p.id} className="text-sm">
            <span className="font-medium">{p.name}</span>
            {p.headline ? <span className="text-muted-foreground">, {p.headline}</span> : null}{" "}
            <Badge variant={p.basis === "mutual" ? "default" : "outline"}>
              {p.basis === "mutual" ? `fit ${p.score.toFixed(2)}` : "serendipity"}
            </Badge>
            <br />
            <span className="text-muted-foreground">{p.why}</span>
            {p.linkedinUrl ? (
              <>
                {" "}
                <a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                  LinkedIn
                </a>
              </>
            ) : p.lumaUrl ? (
              <>
                {" "}
                <a href={p.lumaUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                  Luma profile
                </a>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="mt-3" onClick={sendTest} disabled={busy}>
        {busy ? "Sending…" : "Send this email to me"}
      </Button>
      {sent && <p className="note mt-2 text-sm">{sent}</p>}
    </div>
  );
}

// --- Roster ----------------------------------------------------------------

interface ContactRow {
  id: string;
  name: string;
  email: string;
  eventApprovedCount?: number;
  eventCheckedInCount?: number;
  firstSeenAt?: number;
  emailOptOut?: boolean;
  emailBouncedAt?: number;
  linkedinCandidate?: Candidate;
  profile?: ProfileView;
}

function Roster({ authFetch, ask }: { authFetch: Fetcher; ask: (c: Confirm) => void }) {
  const PER_PAGE = 20;
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [searched, setSearched] = useState("");

  const fetchPage = useCallback(
    async (opts: { q?: string; page?: number }) => {
      setBusy(true);
      setErr(null);
      try {
        const params = new URLSearchParams({ limit: String(PER_PAGE), page: String(opts.page ?? 1) });
        if (opts.q) params.set("q", opts.q);
        const r = (await authFetch(`/api/events/contacts?${params}`)) as {
          contacts: ContactRow[];
          total: number;
          page: number;
          pages: number;
        };
        setRows(r.contacts);
        setSearched(opts.q ?? "");
        setTotal(r.total);
        setPage(r.page);
        setPages(r.pages);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [authFetch],
  );

  // Update the row from the server's answer rather than guessing locally: a
  // resubscribe, for instance, keeps a bounce, and the row must say so.
  async function act(id: string, action: "resubscribe" | "optout" | "clear-bounce") {
    setActing(id);
    setErr(null);
    try {
      const r = (await authFetch(`/api/events/contact/${encodeURIComponent(id)}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      })) as { contact: { emailOptOut: boolean; emailBouncedAt: number | null } };
      setRows((prev) => prev.map((row) => row.id === id
        ? { ...row, emailOptOut: r.contact.emailOptOut, emailBouncedAt: r.contact.emailBouncedAt ?? undefined }
        : row));
    } catch (e) {
      setErr((e as Error).message);
      throw e;
    } finally {
      setActing(null);
    }
  }

  useEffect(() => {
    fetchPage({});
  }, [fetchPage]);

  return (
    <Section title="Subscribers">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="roster-search" className="sr-only">Search subscribers</label>
        <Input
          id="roster-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchPage({ q, page: 1 })}
          placeholder="Search name, email or LinkedIn"
          className="h-10 max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={() => fetchPage({ q, page: 1 })} disabled={busy}>
          Search
        </Button>
        {q && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              fetchPage({ page: 1 });
            }}
          >
            Clear
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {total} {total === 1 ? "subscriber" : "subscribers"}
        </span>
      </div>
      {err && <p className="note mt-2 text-sm">{err}</p>}

      <div className="orbit-card mt-3 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Subscriber</th>
              <th className="px-3 py-2 text-right font-medium" title="Events approved, all time">
                Events
              </th>
              <th className="px-3 py-2 text-right font-medium" title="Luma check-ins, which only exist for events where QR scanning was used">
                Checked in
              </th>
              <th className="px-3 py-2 text-left font-medium">LinkedIn</th>
              <th className="px-3 py-2 text-right font-medium">First seen</th>
              <th className="px-3 py-2 text-right font-medium">Mailing list</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ProfileAvatar profile={c.profile} name={c.name} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{c.name || "(no name)"}</span>
                        {c.emailOptOut && <Badge variant="destructive">opted out</Badge>}
                        {!c.emailOptOut && c.emailBouncedAt ? <Badge variant="outline">bounced</Badge> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">{c.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">{c.eventApprovedCount ?? 0}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{c.eventCheckedInCount ?? 0}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.profile?.linkedinUrl ? (
                      <a href={c.profile.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">profile</a>
                    ) : c.linkedinCandidate?.url ? (
                      <span className="text-xs text-muted-foreground">guess to review</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">none</span>
                    )}
                    <Button variant="outline" size="xs" onClick={() => setEditing(c)}>
                      {c.linkedinCandidate?.url && !c.profile?.linkedinUrl ? "Review" : "Edit"}
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">{fmtDate(c.firstSeenAt)}</td>
                <td className="px-3 py-2 text-right">
                  {/* An opt-out is deliberately one-way in the public route, so the
                      way back lives here and goes through the confirm dialog: putting
                      someone back on a list they left should never be one careless
                      click. Only do it when they asked. */}
                  {c.emailOptOut ? (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={acting === c.id}
                      onClick={() =>
                        ask({
                          title: `Put ${c.name || c.email} back on the list?`,
                          description:
                            "They unsubscribed themselves. Only do this if they have asked to be re-added. It is recorded against your account.",
                          confirmLabel: "Resubscribe",
                          run: () => act(c.id, "resubscribe"),
                        })
                      }
                    >
                      Resubscribe
                    </Button>
                  ) : c.emailBouncedAt ? (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={acting === c.id}
                      onClick={() =>
                        ask({
                          title: `Try ${c.email} again?`,
                          description:
                            "A previous send to this address failed, so they are being skipped. Clear it to include them in the next blast.",
                          confirmLabel: "Clear bounce",
                          run: () => act(c.id, "clear-bounce"),
                        })
                      }
                    >
                      Clear bounce
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={acting === c.id}
                      onClick={() =>
                        ask({
                          title: `Remove ${c.name || c.email} from the list?`,
                          description: "They will stop receiving the people-to-meet and connect emails, and stop being recommended to others.",
                          confirmLabel: "Remove",
                          danger: true,
                          run: () => act(c.id, "optout"),
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!busy && rows.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground">{searched ? `No subscribers match "${searched}".` : "No subscribers yet. Sync the calendar from Luma."}</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => fetchPage({ q, page: page - 1 })} disabled={busy || page <= 1}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Button variant="outline" size="sm" onClick={() => fetchPage({ q, page: page + 1 })} disabled={busy || page >= pages}>
          Next
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Check-in counts come from Luma and only exist for events where guests were scanned at the door.
      </p>
      {editing && (
        <ProfileEditor
          contactId={editing.id}
          name={editing.name}
          profile={editing.profile}
          candidate={editing.profile?.linkedinUrl ? null : editing.linkedinCandidate}
          authFetch={authFetch}
          onClose={() => setEditing(null)}
          onSaved={(next) => setRows((prev) => prev.map((row) => row.id === editing.id ? { ...row, profile: next.profile, linkedinCandidate: next.linkedinCandidate ?? undefined } : row))}
        />
      )}
    </Section>
  );
}
