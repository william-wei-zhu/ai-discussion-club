"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = { enabled: boolean; url?: string; version?: number; createdAt?: number; rotatedAt?: number };

// The event's private directory link. The link is FIXED: it is shown every time
// and only changes when the admin replaces it (or revokes it). A legacy link made
// before links were stored recoverably has no url and must be replaced once.
export function DirectoryControl({ eventId, api }: {
  eventId: string;
  api: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [message, setMessage] = useState("");
  const path = `/api/events/${encodeURIComponent(eventId)}/directory`;

  useEffect(() => {
    let current = true;
    api(path).then((value) => { if (current) setStatus(value as Status); }).catch(() => { if (current) setMessage("Directory status could not be loaded."); });
    return () => { current = false; };
  }, [api, path]);

  async function create(action: "generate" | "rotate") {
    setBusy(true); setMessage(""); setConfirmReplace(false);
    try {
      const result = await api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }) as Status;
      setStatus(result);
      setMessage(action === "rotate" ? "New link created. The old link no longer works." : "Directory link created.");
    } catch { setMessage("The directory link could not be created."); }
    finally { setBusy(false); }
  }

  async function revoke() {
    setBusy(true); setMessage(""); setConfirmReplace(false);
    try { const result = await api(path, { method: "PATCH" }) as Status; setStatus(result); setMessage("The directory link is now revoked."); }
    catch { setMessage("The directory link could not be revoked."); }
    finally { setBusy(false); }
  }

  const replace = confirmReplace
    ? <>
        <span className="text-sm">The current link will stop working.</span>
        <Button variant="destructive" disabled={busy} onClick={() => create("rotate")}>Replace link</Button>
        <Button variant="outline" disabled={busy} onClick={() => setConfirmReplace(false)}>Keep current link</Button>
      </>
    : <Button variant="outline" disabled={busy} onClick={() => setConfirmReplace(true)}>{status?.url ? "Replace link" : "Replace to make this link permanent"}</Button>;

  return <div className="flex flex-wrap items-center gap-2" aria-live="polite">
    {!status ? <span className="text-sm">Loading directory…</span> : status.enabled ? <>
      {replace}
      <Button variant="destructive" disabled={busy} onClick={revoke}>Revoke directory</Button>
    </> : <Button variant="outline" disabled={busy} onClick={() => create("generate")}>Create directory link</Button>}
    {status?.url ? <div className="basis-full rounded-lg border border-border bg-background p-3"><label className="block text-sm font-medium" htmlFor={`directory-${eventId}`}>Directory link</label><div className="mt-2 flex flex-wrap gap-2"><input id={`directory-${eventId}`} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" readOnly value={status.url} onFocus={(e) => e.currentTarget.select()} /><Button onClick={() => navigator.clipboard.writeText(status.url ?? "").then(() => setMessage("Link copied."))}>Copy</Button></div></div> : null}
    {message ? <p className="basis-full text-sm">{message}</p> : null}
  </div>;
}
