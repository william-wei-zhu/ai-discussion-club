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
 * The pieces every password-gated console shares: the two-factor gate, the
 * authenticated fetch, the load hook, the stat/section primitives and the one
 * confirm dialog.
 *
 * Extracted verbatim from components/admin-client.tsx when /events became a
 * second gated console, so there is exactly ONE password key, ONE 401-drops-the-
 * gate behaviour and ONE confirm dialog rather than two copies drifting apart.
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
      const res = await fetch(path, {
        ...init,
        cache: "no-store",
        headers: {
          ...(init?.headers ?? {}),
          "Content-Type": "application/json",
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

  async function run() {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.run();
      onClose();
    } catch {
      // The child surfaces its own error; just keep the dialog open.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!confirm} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirm?.title}</DialogTitle>
          <DialogDescription>{confirm?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
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

export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(() => {
    setLoading(true);
    setErr(null);
    load()
      .then(setData)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => run(), [run]);
  return { data, err, loading, reload: run };
}

export function Stat({
  label,
  value,
  sub,
  spark,
}: {
  label: string;
  value: string | number;
  sub?: string;
  spark?: number[];
}) {
  return (
    <div className="orbit-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold">{value}</p>
      {spark && spark.length > 1 && <Sparkline data={spark} className="mt-1.5 text-primary" />}
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// A tiny dependency-free trend line (inline SVG). Scales the series to a small box
// and stretches to the card width; stroke inherits currentColor.
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = 24;
  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`h-6 w-full ${className ?? ""}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
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
