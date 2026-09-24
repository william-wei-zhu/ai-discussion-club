"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { ProfileView } from "@/lib/profile-rules";

type EventPreference = { id: string; name: string; startAt: number; directoryEnabled: boolean };
type Preferences = { emailOptOut: boolean; profile: ProfileView; events: EventPreference[] };
type Status = { text: string; error?: boolean } | null;

const EXPIRED = "Your private session has ended. Request a new link below to keep editing.";
const PHOTO_SOURCE: Record<ProfileView["photoSource"], string> = {
  uploaded: "The photo you uploaded.",
  linkedin: "From your LinkedIn profile.",
  luma: "From your Luma account.",
  none: "No photo yet, so your initials are shown.",
};

class SessionEnded extends Error {}

async function call(url: string, init: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new SessionEnded();
  if (!response.ok) throw new Error(body.error || "That change could not be saved. Please try again.");
  return body;
}

// Resize in the browser before upload: phone photos are often larger than the
// server's 4 MB limit, and the server re-encodes to a 512px square anyway.
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export function PreferencesClient() {
  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Status>(null);
  const [linkedin, setLinkedin] = useState("");
  const [profileStatus, setProfileStatus] = useState<Status>(null);
  const [photoStatus, setPhotoStatus] = useState<Status>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function show(next: Preferences) {
    setPreferences(next);
    setLinkedin(next.profile.linkedinUrl);
  }

  async function load() {
    try {
      const response = await fetch("/api/preferences", { cache: "no-store" });
      if (response.ok) show(await response.json());
      else setPreferences(null);
    } catch {
      setMessage({ text: "Your preferences could not be loaded. Check your connection and refresh.", error: true });
    }
  }

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) { void load(); return; }
    history.replaceState(null, "", window.location.pathname);
    setBusy(true);
    fetch("/api/preferences/consume", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => { if (!response.ok) throw new Error(); await load(); })
      .catch(() => setMessage({ text: "This private link is invalid or has expired. Request a new one below.", error: true }))
      .finally(() => setBusy(false));
    // Runs once on mount: the link token is read from the URL fragment exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ended() {
    setPreferences(null);
    setMessage({ text: EXPIRED, error: true });
  }

  async function requestLink(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/preferences/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Email is unavailable.");
      setMessage({ text: "If that email belongs to a club member, a private link is on its way. It works for one hour." }); setEmail("");
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "Email is unavailable right now.", error: true }); }
    finally { setBusy(false); }
  }

  async function update(body: unknown) {
    setBusy(true); setMessage(null);
    try {
      await call("/api/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      await load();
      setMessage({ text: "Your preference is saved." });
    } catch (error) {
      if (error instanceof SessionEnded) ended();
      else setMessage({ text: error instanceof Error ? error.message : "That preference could not be saved.", error: true });
    } finally { setBusy(false); }
  }

  async function saveLinkedIn(event: FormEvent, value: string | null) {
    event.preventDefault(); setBusy(true); setProfileStatus(null);
    try {
      const body = await call("/api/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkedinUrl: value }) });
      if (preferences) show({ ...preferences, profile: body.profile });
      setProfileStatus({ text: value ? "Saved. We will use this LinkedIn profile from now on." : "Removed. Your card no longer shows a LinkedIn link." });
    } catch (error) {
      if (error instanceof SessionEnded) ended();
      else setProfileStatus({ text: error instanceof Error ? error.message : "Your LinkedIn could not be saved.", error: true });
    } finally { setBusy(false); }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setPhotoStatus({ text: "Please choose a JPG, PNG, or WebP photo.", error: true }); return; }
    setBusy(true); setPhotoStatus({ text: "Uploading your photo…" });
    try {
      const form = new FormData();
      form.set("photo", await shrink(file), "photo.jpg");
      const body = await call("/api/preferences/photo", { method: "POST", body: form });
      if (preferences) show({ ...preferences, profile: body.profile });
      setPhotoStatus({ text: "Your new photo is saved." });
    } catch (error) {
      if (error instanceof SessionEnded) ended();
      else setPhotoStatus({ text: error instanceof Error ? error.message : "Your photo could not be saved.", error: true });
    } finally { setBusy(false); }
  }

  async function removePhoto() {
    setBusy(true); setPhotoStatus(null);
    try {
      const body = await call("/api/preferences/photo", { method: "DELETE" });
      if (preferences) show({ ...preferences, profile: body.profile });
      setPhotoStatus({ text: "Removed. Your card now uses your next available photo." });
    } catch (error) {
      if (error instanceof SessionEnded) ended();
      else setPhotoStatus({ text: error instanceof Error ? error.message : "Your photo could not be removed.", error: true });
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    await fetch("/api/preferences", { method: "DELETE" }).catch(() => undefined);
    setPreferences(null); setBusy(false);
    setMessage({ text: "You are signed out. Request a new link any time." });
  }

  const statusLine = (status: Status) => status ? <p className={status.error ? "form-status error" : "form-status"} role={status.error ? "alert" : "status"}>{status.text}</p> : null;

  if (preferences) {
    const { profile } = preferences;
    return <div>
      <section className="settings-section">
        <h2>Your directory profile</h2>
        <p>This is how you appear in private event directories and in other members’ “people to meet” emails. If something is wrong, fix it here and it will not be replaced by our automatic lookups.</p>
        <div className="profile-preview">
          {profile.photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.photoUrl} alt="" width={96} height={96} />
            : <span className="profile-initials" aria-hidden="true">{initials(profile.name)}</span>}
          <div>
            <p className="profile-name">{profile.name || "Your name"}</p>
            {profile.headline ? <p>{profile.headline}</p> : null}
            {profile.linkedinUrl ? <p><a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn profile</a></p> : <p>No LinkedIn link shown.</p>}
          </div>
        </div>

        <h3 className="profile-subhead">Profile photo</h3>
        <p>{PHOTO_SOURCE[profile.photoSource]}</p>
        <div className="button-row">
          <input ref={fileInput} id="profile-photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={busy} />
          <button type="button" className="button" disabled={busy} onClick={() => fileInput.current?.click()}>{profile.uploadedPhoto ? "Replace photo" : "Upload a photo"}</button>
          {profile.uploadedPhoto ? <button type="button" className="button secondary" disabled={busy} onClick={removePhoto}>Remove my photo</button> : null}
        </div>
        {statusLine(photoStatus)}

        <h3 className="profile-subhead">LinkedIn</h3>
        <form className="mt-3 grid max-w-xl gap-3" onSubmit={(event) => saveLinkedIn(event, linkedin.trim() || null)}>
          <label htmlFor="profile-linkedin">Your LinkedIn profile link</label>
          <input className="min-h-12 rounded-xl border border-input bg-background px-4" id="profile-linkedin" type="url" inputMode="url" placeholder="https://www.linkedin.com/in/your-name" autoComplete="url" value={linkedin} onChange={(event) => setLinkedin(event.target.value)} />
          <div className="button-row">
            <button className="button" disabled={busy || linkedin.trim() === profile.linkedinUrl}>Save LinkedIn</button>
            {profile.linkedinUrl ? <button type="button" className="button secondary" disabled={busy} onClick={(event) => saveLinkedIn(event as unknown as FormEvent, null)}>Remove LinkedIn</button> : null}
          </div>
        </form>
        {statusLine(profileStatus)}
      </section>

      <section className="settings-section"><h2>Club email</h2><p>Turn off event recommendations and club updates sent to your email.</p><label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={preferences.emailOptOut} disabled={busy} onChange={(event) => update({ emailOptOut: event.target.checked })} /><span>Do not send me club email</span></label></section>
      <section className="settings-section"><h2>Private event directories</h2><p>If you are going to an event, you appear in its private directory unless you turn it off here. Anyone with the event’s private link sees your profile above and whether you are a host. Your email and registration answers are never shown.</p>
        {preferences.events.length ? <div className="grid gap-3">{preferences.events.map((event) => <label className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-secondary p-4" key={event.id}><span>{event.name}<br /><span className="text-sm">{event.directoryEnabled ? "Listed in this directory" : "Hidden from this directory"}</span></span><input type="checkbox" aria-label={`Show me in the ${event.name} directory`} checked={event.directoryEnabled} disabled={busy} onChange={(input) => update({ directory: { eventId: event.id, enabled: input.target.checked } })} /></label>)}</div> : <p>You do not have an eligible event directory yet.</p>}
      </section>
      {statusLine(message)}
      <section className="settings-section"><button type="button" className="button secondary" disabled={busy} onClick={signOut}>Sign out</button></section>
    </div>;
  }

  return <section className="settings-section"><h2>Send me a private link</h2><p>Use the email you registered with. For privacy, the result is the same whether or not we recognize it.</p><form className="mt-5 grid max-w-xl gap-3" onSubmit={requestLink}><label htmlFor="preference-email">Email address</label><input className="min-h-12 rounded-xl border border-input bg-background px-4" id="preference-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><button className="button w-fit" disabled={busy}>{busy ? "Please wait…" : "Email my private link"}</button></form>{statusLine(message)}</section>;
}
