"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not sign in");
      // Full navigation, not client-side routing — middleware needs to see
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
