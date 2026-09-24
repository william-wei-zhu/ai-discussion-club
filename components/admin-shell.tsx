"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * The pieces the password-gated /admin console uses: the two-factor gate, the
 * authenticated fetch, the load hook, the section primitive and the one confirm
 * dialog, kept together so there is exactly ONE password key, ONE 401-drops-the-
 * gate behaviour and ONE confirm dialog.
 */

// Where the admin password lives for the session (sent as a header on every
// gated call; the server re-checks it, this is just UI convenience).
// Access requires BOTH this password AND a signed-in admin Google account.
export const PW_KEY = "ai-discussion-club:admin-pw";

/** A pending destructive action awaiting confirmation in the shared dialog. */
export type Confirm = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<void>;
};

export type Fetcher = (path: string, init?: RequestInit) => Promise<unknown>;

type GateUser = { email: string | null; getIdToken: () => Promise<string> } | null;

/**
 * Authenticated fetch: sends BOTH the Google identity (Firebase ID token) and the
 * admin password header on every call. The server requires both. A 401 means one
 * factor no longer holds, so we clear the password and drop back to the gate.
 */
export function useAuthFetch(user: GateUser, onDenied: () => void): Fetcher {
  return useCallback(
    async (path: string, init?: RequestInit) => {
      if (!user) throw new Error("Sign in first.");
      const idToken = await user.getIdToken();
      const password = sessionStorage.getItem(PW_KEY) ?? "";
      // A FormData body (photo upload) must set its own multipart boundary.
      const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
      const res = await fetch(path, {
        ...init,
        cache: "no-store",
        headers: {
          ...(init?.headers ?? {}),
          ...(isForm ? {} : { "Content-Type": "application/json" }),
          Authorization: `Bearer ${idToken}`,
          "x-admin-password": password,
        },
      });
      if (res.status === 401) {
        sessionStorage.removeItem(PW_KEY);
        onDenied();
        throw new Error("Access denied. Check the password and that you're signed in with an admin account.");
      }
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Something went wrong.");
      }
      return res.json();
    },
    // onDenied is a setState updater in both callers, so it is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );
}

/**
 * Two factors: (1) sign in with an admin Google account, then (2) enter the
 * password. The password is validated against a real gated endpoint (which also
 * re-checks the Google identity), so a wrong password OR a non-admin account both
 * fail here rather than later.
 */
export function Gate({
  title,
  validatePath,
  user,
  signInWithGoogle,
  pw,
  setPw,
  onAuthed,
}: {
  title: string;
  validatePath: string;
  user: GateUser;
  signInWithGoogle: () => Promise<void>;
  pw: string;
  setPw: (s: string) => void;
  onAuthed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn() {
    setErr(null);
    try {
      await signInWithGoogle();
    } catch {
      setErr("Sign-in failed. Try again.");
    }
  }

  async function submit() {
    if (!pw.trim() || busy || !user) return;
    setBusy(true);
    setErr(null);
    try {
      // Validate both factors at once against a real gated endpoint.
      const idToken = await user.getIdToken();
      const res = await fetch(validatePath, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${idToken}`, "x-admin-password": pw },
      });
      if (res.status === 401) throw new Error("Access denied. Wrong password, or this Google account isn't an admin.");
      if (!res.ok) throw new Error("Something went wrong. Try again.");
      sessionStorage.setItem(PW_KEY, pw);
      onAuthed();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-heading text-3xl font-bold">{title}</h1>

      {!user ? (
        <>
          <p className="mt-1 text-base text-muted-foreground">Sign in with your admin Google account to continue.</p>
          {err && <p className="note mt-4 text-sm">{err}</p>}
          <Button size="lg" className="mt-5 w-full text-base" onClick={signIn}>
            Sign in with Google
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-base text-muted-foreground">
            Signed in as {user.email}. Enter the admin password to continue.
          </p>
          <div className="mt-5 space-y-3">
            <Label htmlFor="admin-pw" className="text-base">Password</Label>
            <Input
              id="admin-pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Password"
              className="h-11 text-base"
              autoFocus
            />
            {err && <p className="note text-sm">{err}</p>}
            <Button size="lg" className="w-full text-base" onClick={submit} disabled={busy || !pw.trim()}>
              {busy ? "Checking…" : "Unlock"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** The one confirm dialog every destructive action routes through. */
export function ConfirmDialog({
  confirm,
  onClose,
}: {
  confirm: Confirm | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!confirm) return;
    setBusy(true);
    setErr(null);
    try {
      await confirm.run();
      onClose();
    } catch (e) {
      // Keep the dialog open AND say why: a silent failure here once meant a
      // "Stop the emails" click that did nothing without telling anyone.
      setErr((e as Error).message || "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) { setErr(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirm?.title}</DialogTitle>
          <DialogDescription>{confirm?.description}</DialogDescription>
        </DialogHeader>
        {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setErr(null); onClose(); }} disabled={busy}>
            Cancel
          </Button>
          <Button variant={confirm?.danger ? "destructive" : "default"} onClick={run} disabled={busy}>
            {busy ? "Working…" : confirm?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Load once, then refresh in the background. `loading` is only true for the very
 * first load: a reload keeps the current data on screen (so cards stay mounted and
 * their result messages survive) and flips `refreshing` instead.
 */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const run = useCallback((background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setErr(null);
    load()
      .then(setData)
      .catch((e) => setErr((e as Error).message))
      .finally(() => { setLoading(false); setRefreshing(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => run(), [run]);
  const reload = useCallback(() => run(true), [run]);
  return { data, err, loading, refreshing, reload };
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <p className="eyebrow text-primary">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function fmtTime(ms: unknown) {
  const n = Number(ms);
  if (!n) return "";
  return new Date(n).toLocaleString();
}

// Compact date (no time) for dense tables.
export function fmtDate(ms: unknown) {
  const n = Number(ms);
  if (!n) return "Not available";
  return new Date(n).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}
