"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Section, fmtDate, useLoad, type Fetcher } from "@/components/admin-shell";
import {
  ADMIN_NOTE_MAX,
  DEMO_STATUSES,
  demoApplicationsCsv,
  type DemoApplication,
  type DemoStatus,
} from "@/lib/demo-applications";

// The admin "Demo applications" tab: everything submitted at /demo, newest first.
// Status and the private note save per row; the export is the current filtered view.

const STATUS_LABEL: Record<DemoStatus, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  declined: "Declined",
};

type Filter = "all" | DemoStatus;

export function DemoApplications({ authFetch }: { authFetch: Fetcher }) {
  const { data, err, loading, refreshing, reload } = useLoad(
    async () => ((await authFetch("/api/events/demo-applications")) as { applications: DemoApplication[] }).applications,
  );
  const [rows, setRows] = useState<DemoApplication[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [rowErr, setRowErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  async function patch(id: string, body: { status?: DemoStatus; adminNote?: string }) {
    setRowErr(null);
    try {
      await authFetch(`/api/events/demo-applications/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...body } : r)));
      return true;
    } catch (e) {
      setRowErr((e as Error).message);
      return false;
    }
  }

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const count = (f: Filter) => (f === "all" ? rows.length : rows.filter((r) => r.status === f).length);

  function exportCsv() {
    const blob = new Blob([demoApplicationsCsv(shown)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demo-applications${filter === "all" ? "" : `-${filter}`}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section title="Demo applications">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-xl border p-1">
          {(["all", ...DEMO_STATUSES] as Filter[]).map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-sm font-semibold transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]} ({count(f)})
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={shown.length === 0}>
          Export CSV
        </Button>
        <Button variant="ghost" size="sm" onClick={reload} disabled={loading || refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
        <a href="/demo" target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-4">
          Open the public form
        </a>
      </div>
      {(err || rowErr) && <p className="note mt-2 text-sm">{err || rowErr}</p>}

      <div className="orbit-card mt-3 overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Submitted</th>
              <th className="px-3 py-2 text-left font-medium">Applicant</th>
              <th className="px-3 py-2 text-left font-medium">Project</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-3">
                  <div className="font-medium">{r.name}</div>
                  <a href={`mailto:${r.email}`} className="text-xs text-primary underline underline-offset-4">{r.email}</a>
                  <div className="mt-1 text-xs text-muted-foreground">{r.company || "No company given"}</div>
                </td>
                <td className="max-w-md px-3 py-3">
                  <p className="whitespace-pre-wrap">{r.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button variant="outline" size="xs" asChild>
                      <a href={r.projectUrl} target="_blank" rel="noopener noreferrer">Project</a>
                    </Button>
                    <Button variant="outline" size="xs" asChild>
                      <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <label htmlFor={`demo-status-${r.id}`} className="sr-only">Status for {r.name}</label>
                  <select
                    id={`demo-status-${r.id}`}
                    value={r.status}
                    onChange={(e) => patch(r.id, { status: e.target.value as DemoStatus })}
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  >
                    {DEMO_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <NoteField key={r.id} initial={r.adminNote} name={r.name} onSave={(adminNote) => patch(r.id, { adminNote })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && shown.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {rows.length === 0 ? "No applications yet. Share the /demo page to collect them." : "No applications with this status."}
          </p>
        )}
        {loading && <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>}
      </div>
    </Section>
  );
}

function NoteField({ initial, name, onSave }: { initial: string; name: string; onSave: (note: string) => Promise<boolean> }) {
  const [note, setNote] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  async function save() {
    if (note === initial) return;
    setState("saving");
    setState((await onSave(note)) ? "saved" : "idle");
  }

  return (
    <div className="grid gap-1">
      <textarea
        aria-label={`Private note for ${name}`}
        value={note}
        maxLength={ADMIN_NOTE_MAX}
        onChange={(e) => { setNote(e.target.value); setState("idle"); }}
        onBlur={save}
        rows={2}
        placeholder="Private note"
        className="w-56 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
      />
      <span className="h-4 text-xs text-muted-foreground">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}</span>
    </div>
  );
}
