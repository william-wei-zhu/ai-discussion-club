"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Confirm, Fetcher } from "@/components/admin-shell";
import type { DirectoryStatus } from "@/lib/directory";

// The event's private directory link. The link is FIXED: it is shown every time
// and only changes when the admin replaces it (or revokes it). A legacy link made
// before links were stored recoverably has no url and must be replaced once.
// Status arrives with the event list, so a card never fetches it on its own.
export function DirectoryControl({ eventId, initial, api, ask }: {
  eventId: string;
  initial?: DirectoryStatus;
  api: Fetcher;
  ask: (c: Confirm) => void;
}) {
  const [status, setStatus] = useState<DirectoryStatus>(initial ?? { enabled: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const path = `/api/events/${encodeURIComponent(eventId)}/directory`;

  async function create(action: "generate" | "rotate") {
    setBusy(true); setMessage(null);
    try {
      setStatus(await api(path, { method: "POST", body: JSON.stringify({ action }) }) as DirectoryStatus);
      setMessage({ text: action === "rotate" ? "New link created. The old link no longer works." : "Directory link created." });
    } catch (e) { setMessage({ text: (e as Error).message, error: true }); throw e; }
    finally { setBusy(false); }
  }

  async function revoke() {
    setBusy(true); setMessage(null);
    try { setStatus(await api(path, { method: "PATCH" }) as DirectoryStatus); setMessage({ text: "The directory is now off." }); }
    catch (e) { setMessage({ text: (e as Error).message, error: true }); throw e; }
    finally { setBusy(false); }
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      {status.enabled ? <>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => ask({
          title: status.url ? "Replace the directory link?" : "Replace the legacy link?",
          description: status.url
            ? "The current link stops working immediately, including in emails already sent. Only do this if the link leaked."
            : "This link was made before links were stored, so it cannot be shown. Replacing it creates a permanent link; the old one stops working.",
          confirmLabel: "Replace link",
          danger: !!status.url,
          run: () => create("rotate"),
        })}>{status.url ? "Replace link" : "Replace to make permanent"}</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => ask({
          title: "Turn off this event's directory?",
          description: "The link stops working for everyone, and the connect email for this event will not send while the directory is off.",
          confirmLabel: "Turn off directory",
          danger: true,
          run: revoke,
        })}>Turn off directory</Button>
      </> : <Button variant="outline" size="sm" disabled={busy} onClick={() => { void create("generate").catch(() => undefined); }}>
        {status.revokedAt ? "Turn directory back on (new link)" : "Create directory link"}
      </Button>}
    </div>
    {status.url ? <div className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor={`directory-${eventId}`}>Directory link</label>
      <input id={`directory-${eventId}`} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" readOnly value={status.url} onFocus={(e) => e.currentTarget.select()} />
      <Button size="sm" onClick={() => navigator.clipboard.writeText(status.url ?? "").then(() => setMessage({ text: "Link copied." }))}>Copy</Button>
    </div> : null}
    {message ? <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-destructive" : ""}`}>{message.text}</p> : null}
  </div>;
}
