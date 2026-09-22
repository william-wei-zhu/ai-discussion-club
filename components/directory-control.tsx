"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = { enabled: boolean; version?: number; createdAt?: number; rotatedAt?: number };

export function DirectoryControl({ eventId, api }: {
  eventId: string;
  api: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [oneTimeUrl, setOneTimeUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const path = `/api/events/${encodeURIComponent(eventId)}/directory`;

  useEffect(() => {
    let current = true;
    api(path).then((value) => { if (current) setStatus(value as Status); }).catch(() => { if (current) setMessage("Directory status could not be loaded."); });
    return () => { current = false; };
  }, [api, path]);

  async function create(action: "generate" | "rotate") {
    setBusy(true); setMessage(""); setOneTimeUrl("");
    try {
      const result = await api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }) as Status & { url: string };
      setStatus(result); setOneTimeUrl(result.url); setMessage("Copy this link now. It will not be shown again.");
    } catch { setMessage("The directory link could not be created."); }
    finally { setBusy(false); }
  }

  async function revoke() {
    setBusy(true); setMessage(""); setOneTimeUrl("");
    try { const result = await api(path, { method: "PATCH" }) as Status; setStatus(result); setMessage("The old directory link is now revoked."); }
    catch { setMessage("The directory link could not be revoked."); }
    finally { setBusy(false); }
  }

  return <div className="flex flex-wrap items-center gap-2" aria-live="polite">
    {!status ? <span className="text-sm">Loading directory…</span> : status.enabled ? <>
      <Button variant="outline" disabled={busy} onClick={() => create("rotate")}>Rotate directory link</Button>
      <Button variant="destructive" disabled={busy} onClick={revoke}>Revoke directory</Button>
    </> : <Button variant="outline" disabled={busy} onClick={() => create("generate")}>Create directory link</Button>}
    {oneTimeUrl ? <div className="basis-full rounded-lg border border-border bg-background p-3"><label className="block text-sm font-medium" htmlFor={`directory-${eventId}`}>One-time link</label><div className="mt-2 flex flex-wrap gap-2"><input id={`directory-${eventId}`} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" readOnly value={oneTimeUrl} onFocus={(e) => e.currentTarget.select()} /><Button onClick={() => navigator.clipboard.writeText(oneTimeUrl).then(() => setMessage("Link copied."))}>Copy</Button></div></div> : null}
    {message ? <p className="basis-full text-sm">{message}</p> : null}
  </div>;
}
