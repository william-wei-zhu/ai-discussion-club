"use client";

import { FormEvent, useEffect, useState } from "react";

type EventPreference = { id: string; name: string; startAt: number; directoryEnabled: boolean };
type Preferences = { emailOptOut: boolean; events: EventPreference[] };

export function PreferencesClient() {
  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/preferences", { cache: "no-store" });
    if (response.ok) setPreferences(await response.json());
  }

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) { void load(); return; }
    history.replaceState(null, "", window.location.pathname);
    setBusy(true);
    fetch("/api/preferences/consume", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => { if (!response.ok) throw new Error(); await load(); })
      .catch(() => setMessage("This private link is invalid or has expired. Request a new one below."))
      .finally(() => setBusy(false));
  }, []);

  async function requestLink(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/preferences/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Email is unavailable.");
      setMessage("If that email belongs to a club member, a private link is on its way."); setEmail("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Email is unavailable right now."); }
    finally { setBusy(false); }
  }

  async function update(body: unknown) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { setMessage("That preference could not be saved. Your private session may have expired."); setBusy(false); return; }
    await load(); setMessage("Your preference is saved."); setBusy(false);
  }

  if (preferences) return <div aria-live="polite">
    <section className="settings-section"><h2>Club email</h2><p>Turn off event recommendations and club updates sent to your email.</p><label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={preferences.emailOptOut} disabled={busy} onChange={(event) => update({ emailOptOut: event.target.checked })} /><span>Do not send me club email</span></label></section>
    <section className="settings-section"><h2>Private event directories</h2><p>If you are going to an event, you appear in its private directory unless you turn it off here. Anyone who has the event’s private link can see your name, profile background, trusted profile photo, LinkedIn link, and whether you are a host. Your email and registration answers are never shown.</p>
      {preferences.events.length ? <div className="grid gap-3">{preferences.events.map((event) => <label className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-secondary p-4" key={event.id}><span>{event.name}</span><input type="checkbox" checked={event.directoryEnabled} disabled={busy} onChange={(input) => update({ directory: { eventId: event.id, enabled: input.target.checked } })} /></label>)}</div> : <p>You do not have an eligible event directory yet.</p>}
    </section>{message ? <p role="status">{message}</p> : null}
  </div>;

  return <section className="settings-section"><h2>Send me a private link</h2><p>Use the email you registered with. For privacy, the result is the same whether or not we recognize it.</p><form className="mt-5 grid max-w-xl gap-3" onSubmit={requestLink}><label htmlFor="preference-email">Email address</label><input className="min-h-12 rounded-xl border border-input bg-background px-4" id="preference-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><button className="button w-fit" disabled={busy}>{busy ? "Please wait…" : "Email my private link"}</button></form>{message ? <p className="mt-4" role="status">{message}</p> : null}</section>;
}
