"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Fetcher } from "@/components/admin-shell";
import type { ProfileView } from "@/lib/profile-rules";

const SOURCE: Record<ProfileView["photoSource"], string> = {
  uploaded: "Uploaded photo",
  linkedin: "LinkedIn photo",
  luma: "Luma avatar",
  none: "No photo",
};

export type Candidate = { url: string; name?: string; headline?: string } | null | undefined;

// A small avatar with the source of the photo on hover, used in admin tables.
export function ProfileAvatar({ profile, name }: { profile?: ProfileView; name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return profile?.photoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={profile.photoUrl} alt="" title={SOURCE[profile.photoSource]} className="size-9 shrink-0 rounded-full border border-border object-cover" />
    : <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{letters}</span>;
}

/**
 * Admin editor for one contact's public profile: the LinkedIn URL (admin-set values
 * are locked against enrichment), the photo, and the pending Exa guess.
 */
export function ProfileEditor({
  contactId,
  name,
  profile,
  candidate,
  authFetch,
  onClose,
  onSaved,
}: {
  contactId: string;
  name: string;
  profile?: ProfileView;
  candidate?: Candidate;
  authFetch: Fetcher;
  onClose: () => void;
  onSaved: (next: { profile: ProfileView; linkedinCandidate?: Candidate }) => void;
}) {
  const [linkedin, setLinkedin] = useState(profile?.linkedinUrl ?? "");
  const [current, setCurrent] = useState<ProfileView | undefined>(profile);
  const [guess, setGuess] = useState<Candidate>(candidate);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const base = `/api/events/contact/${encodeURIComponent(contactId)}`;

  async function run(label: string, fn: () => Promise<{ profile?: ProfileView; contact?: { profile: ProfileView; linkedinCandidate?: Candidate } }>) {
    setBusy(true);
    setStatus(null);
    try {
      const r = await fn();
      const next = r.contact?.profile ?? r.profile;
      if (next) {
        setCurrent(next);
        setLinkedin(next.linkedinUrl);
        const nextGuess = r.contact ? r.contact.linkedinCandidate ?? null : guess;
        setGuess(nextGuess);
        onSaved({ profile: next, linkedinCandidate: nextGuess });
      }
      setStatus({ text: label });
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  const action = (body: Record<string, unknown>) => () => authFetch(base, { method: "POST", body: JSON.stringify(body) }) as Promise<{ contact: { profile: ProfileView; linkedinCandidate?: Candidate } }>;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {name || "profile"}</DialogTitle>
          <DialogDescription>What shows in directories and people-to-meet emails. Values you set here are never replaced by automatic lookups.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <ProfileAvatar profile={current} name={name} />
          <div className="text-sm">
            <p className="font-medium">{SOURCE[current?.photoSource ?? "none"]}</p>
            <p className="text-muted-foreground">{current?.linkedinUrl ? `LinkedIn set (${current.linkedinSource || "unknown source"})` : "No trusted LinkedIn"}</p>
          </div>
        </div>

        {guess?.url && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">Pending LinkedIn guess</p>
            <p className="mt-1 break-all">
              <a href={guess.url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">{guess.name || guess.url}</a>
              {guess.headline ? ` · ${guess.headline}` : ""}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => run("Guess confirmed. Their profile is being read now.", action({ action: "confirm-linkedin" }))}>This is them</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Guess rejected. It will not be suggested again.", action({ action: "reject-linkedin" }))}>Not them</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`li-${contactId}`}>LinkedIn profile link</Label>
          <Input id={`li-${contactId}`} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/in/…" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || !linkedin.trim() || linkedin.trim() === current?.linkedinUrl} onClick={() => run("LinkedIn saved and locked. Their profile is being read now.", action({ action: "set-linkedin", url: linkedin }))}>Save LinkedIn</Button>
            {current?.linkedinUrl && <Button size="sm" variant="outline" disabled={busy} onClick={() => run("LinkedIn removed.", action({ action: "clear-linkedin" }))}>Remove LinkedIn</Button>}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Photo</p>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const form = new FormData();
            form.set("photo", f);
            void run("Photo saved.", () => authFetch(`${base}/photo`, { method: "POST", body: form }) as Promise<{ profile: ProfileView }>);
          }} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => file.current?.click()}>{current?.uploadedPhoto ? "Replace photo" : "Upload photo"}</Button>
            {current?.uploadedPhoto && <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Uploaded photo removed.", () => authFetch(`${base}/photo`, { method: "DELETE" }) as Promise<{ profile: ProfileView }>)}>Remove uploaded photo</Button>}
          </div>
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP under 4 MB. It is cropped to a square and replaces the LinkedIn and Luma photos everywhere.</p>
        </div>

        {status && <p role={status.error ? "alert" : "status"} className={`text-sm font-medium ${status.error ? "text-destructive" : ""}`}>{busy ? "Working…" : status.text}</p>}
      </DialogContent>
    </Dialog>
  );
}
