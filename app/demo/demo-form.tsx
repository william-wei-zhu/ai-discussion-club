"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import Link from "next/link";
import type { DemoField } from "@/lib/demo-applications";

const INPUT = "min-h-12 w-full rounded-xl border border-input bg-background px-4";
const EMPTY: Record<DemoField, string> = { name: "", email: "", description: "", projectUrl: "", linkedinUrl: "", company: "" };

export function DemoForm() {
  const [values, setValues] = useState(EMPTY);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<DemoField, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (field: DemoField) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors((x) => ({ ...x, [field]: undefined }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/demo-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website }),
      });
      const data = await res.json().catch(() => null) as { error?: string; errors?: Partial<Record<DemoField, string>> } | null;
      if (!res.ok) {
        setErrors(data?.errors ?? {});
        setMessage(data?.error ?? "Something went wrong. Try again.");
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setMessage("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <section className="settings-section" aria-live="polite"><h2>Application received.</h2><p>Thanks for applying. We sent a confirmation to {values.email.trim()} and will reach out by email if your project is a fit for an upcoming demo night.</p><div className="button-row"><Link className="button" href="/events">See upcoming events</Link></div></section>;
  }

  const field = (id: DemoField, label: string, input: ReactNode, hint?: string) => (
    <div className="grid gap-2">
      <label htmlFor={`demo-${id}`} className="font-medium">{label}</label>
      {hint ? <span id={`demo-${id}-hint`} className="text-sm text-muted-foreground">{hint}</span> : null}
      {input}
      {errors[id] ? <span id={`demo-${id}-error`} className="text-sm font-medium text-destructive">{errors[id]}</span> : null}
    </div>
  );
  const aria = (id: DemoField, hint = false) => ({
    id: `demo-${id}`,
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": [hint ? `demo-${id}-hint` : "", errors[id] ? `demo-${id}-error` : ""].filter(Boolean).join(" ") || undefined,
  });

  return <section className="settings-section">
    <h2>Apply to demo</h2>
    <p>Everything is required except your company.</p>
    <form className="grid max-w-xl gap-6" onSubmit={submit} noValidate>
      {field("name", "Full name", <input className={INPUT} {...aria("name")} autoComplete="name" required maxLength={120} value={values.name} onChange={set("name")} />)}
      {field("email", "Email address", <input className={INPUT} {...aria("email")} type="email" autoComplete="email" required value={values.email} onChange={set("email")} />)}
      {field("description", "What would you like to show?", <textarea className={`${INPUT} min-h-36 py-3`} {...aria("description", true)} required maxLength={1500} value={values.description} onChange={set("description")} />, "Describe your project in two to four sentences.")}
      {field("projectUrl", "Project link", <input className={INPUT} {...aria("projectUrl", true)} type="url" inputMode="url" placeholder="https://" required value={values.projectUrl} onChange={set("projectUrl")} />, "A GitHub repository, published website or app store page.")}
      {field("linkedinUrl", "LinkedIn profile link", <input className={INPUT} {...aria("linkedinUrl")} type="url" inputMode="url" placeholder="https://www.linkedin.com/in/your-name" required value={values.linkedinUrl} onChange={set("linkedinUrl")} />)}
      {field("company", "Where do you work? (optional)", <input className={INPUT} {...aria("company", true)} autoComplete="organization" maxLength={120} value={values.company} onChange={set("company")} />, "If you work full time on your project, say so here.")}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="demo-website">Leave this field empty</label>
        <input id="demo-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div>
        <button className="button" disabled={busy}>{busy ? "Sending…" : "Submit application"}</button>
        {message ? <p className="form-status error" role="alert">{message}</p> : null}
        <p className="mt-4 text-sm text-muted-foreground">We use this information only to review demo applications. See our <Link href="/privacy">privacy policy</Link>.</p>
      </div>
    </form>
  </section>;
}
