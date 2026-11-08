"use client";

import { useState } from "react";
import { buttonStyles } from "@/components/ui/button";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set after a correct password when two-step sign-in is on.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = challenge
        ? await fetch("/api/auth/login/code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ challenge, code }),
          })
        : await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
      const body = await res.json();
      if (body.restart) {
        setChallenge(null);
        setCode("");
      }
      if (!res.ok) throw new Error(body.error ?? "Could not sign in");
      if (body.needsCode) {
        setChallenge(body.challenge);
        setSubmitting(false);
        return;
      }
      // Full navigation, not client-side routing, middleware needs to see
      // the cookie the browser just received on the next request, and a
      // client-side transition can race ahead of that.
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {challenge ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">6-digit code</span>
          <span className="text-xs text-zinc-500">Open your authenticator app and enter the code for BookMeIn.</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-lg tracking-[0.3em]"
          />
        </label>
      ) : (
        <>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Email</span>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
        </>
      )}
      {error && (
        <p className="animate-in rounded-lg border border-red-100 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} className={buttonStyles("primary", "md", "mt-1 w-full")}>
        {submitting && (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z" />
          </svg>
        )}
        {submitting ? "Signing in…" : challenge ? "Confirm code" : "Sign in"}
      </button>
      {challenge && (
        <button
          type="button"
          onClick={() => {
            setChallenge(null);
            setCode("");
            setError(null);
          }}
          className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
        >
          Back
        </button>
      )}
    </form>
  );
}
