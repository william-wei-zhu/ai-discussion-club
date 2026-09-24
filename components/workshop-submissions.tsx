"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Section, fmtDate, useLoad, type Fetcher } from "@/components/admin-shell";
import { workshopTitle, type WorkshopSubmission } from "@/lib/workshop-submissions";

// The admin "Workshop submissions" tab: every gallery entry, newest first. Entries
// go live the moment they are submitted, so the one control here is Hide / Show.
export function WorkshopSubmissions({ authFetch }: { authFetch: Fetcher }) {
  const { data, err, loading, refreshing, reload } = useLoad(
    async () => ((await authFetch("/api/events/workshop-submissions")) as { submissions: WorkshopSubmission[] }).submissions,
  );
  const [rows, setRows] = useState<WorkshopSubmission[]>([]);
  const [rowErr, setRowErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  async function setHidden(id: string, hidden: boolean) {
    setRowErr(null);
    try {
      await authFetch(`/api/events/workshop-submissions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ hidden }) });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, hidden } : r)));
    } catch (e) {
      setRowErr((e as Error).message);
    }
  }

  const hiddenCount = rows.filter((r) => r.hidden).length;

  return (
    <Section title="Workshop submissions">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {rows.length} total, {rows.length - hiddenCount} public, {hiddenCount} hidden
        </span>
        <Button variant="ghost" size="sm" onClick={reload} disabled={loading || refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
        <a href="/workshops/submissions" target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-4">
          Open the public gallery
        </a>
      </div>
      {(err || rowErr) && <p className="note mt-2 text-sm">{err || rowErr}</p>}

      <div className="orbit-card mt-3 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Submitted</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Link</th>
              <th className="px-3 py-2 text-left font-medium">Workshop</th>
              <th className="px-3 py-2 text-left font-medium">Gallery</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b align-top last:border-0 ${r.hidden ? "opacity-60" : ""}`}>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-3 font-medium">{r.name}</td>
                <td className="max-w-xs break-all px-3 py-3">
                  <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-4">{r.url}</a>
                </td>
                <td className="px-3 py-3">{workshopTitle(r.workshop)}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  <Button variant={r.hidden ? "default" : "outline"} size="sm" onClick={() => setHidden(r.id, !r.hidden)}>
                    {r.hidden ? "Show" : "Hide"}
                  </Button>
                  <span className="ml-2 text-xs text-muted-foreground">{r.hidden ? "Hidden" : "Public"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground">No submissions yet. They come from the last step of each workshop.</p>
        )}
        {loading && <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>}
      </div>
    </Section>
  );
}
