"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { SubmissionField } from "@/lib/workshop-submissions";

const INPUT = "min-h-12 w-full rounded-full border-2 border-input bg-background px-5 text-[length:var(--ws-body,1.05rem)] text-foreground outline-none placeholder:text-foreground/45 focus-visible:border-primary";

// The finish slide's payoff: name plus the app's web address, straight into the
// shared workshop gallery, so the room can see what everyone built.
export function WorkshopSubmitForm({ workshop }: { workshop: string }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<SubmissionField, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/workshop-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshop, name, url, website }),
      });
      const data = await res.json().catch(() => null) as { error?: string; errors?: Partial<Record<SubmissionField, string>> } | null;
      if (!res.ok) {
        setErrors(data?.errors ?? {});
        setMessage(data?.error ?? "Something went wrong. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setMessage("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="ws-submit" aria-live="polite">
        <p className="kicker flex items-center gap-2"><Check className="h-4 w-4" /> You are in the gallery</p>
        <p className="text-[length:var(--ws-body)]">Thanks, {name.trim()}. Your app is now on the workshop gallery with everyone else&apos;s.</p>
        <Link className="button self-start" href="/workshops/submissions">
          See what people built <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    );
  }

  const describedBy = (f: SubmissionField) => (errors[f] ? `ws-${f}-error` : undefined);

  return (
    <form className="ws-submit" onSubmit={submit} noValidate>
      <p className="kicker">Add your app to the gallery</p>
      <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid content-start gap-2">
        <label htmlFor="ws-name" className="font-medium">Your name</label>
        <input id="ws-name" className={INPUT} autoComplete="name" maxLength={80} value={name}
          aria-invalid={errors.name ? true : undefined} aria-describedby={describedBy("name")}
          onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} />
        {errors.name ? <span id="ws-name-error" className="text-sm font-medium text-destructive">{errors.name}</span> : null}
      </div>
      <div className="grid content-start gap-2">
        <label htmlFor="ws-url" className="font-medium">Your app&apos;s web address</label>
        <input id="ws-url" className={INPUT} type="url" inputMode="url" placeholder="your-app.vercel.app" value={url}
          aria-invalid={errors.url ? true : undefined} aria-describedby={describedBy("url")}
          onChange={(e) => { setUrl(e.target.value); setErrors((x) => ({ ...x, url: undefined })); }} />
        {errors.url ? <span id="ws-url-error" className="text-sm font-medium text-destructive">{errors.url}</span> : null}
      </div>
      </div>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="ws-website">Leave this field empty</label>
        <input id="ws-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <button className="button shrink-0 self-start sm:self-auto" disabled={busy}>{busy ? "Sharing…" : "Share my app"}</button>
        <p className="text-sm">Your name and link appear publicly on the <Link href="/workshops/submissions">workshop gallery</Link>.</p>
      </div>
      {message ? <p className="form-status error !mt-0" role="alert">{message}</p> : null}
    </form>
  );
}
