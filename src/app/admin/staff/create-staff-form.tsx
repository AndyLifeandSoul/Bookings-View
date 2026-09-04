"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createStaffUser, type CreateStaffResult } from "./actions";
import type { VenueOption } from "@/lib/venues/list-active-venues";

export function CreateStaffForm({ venues }: { venues: VenueOption[] }) {
  const [state, formAction, pending] = useActionState<CreateStaffResult, FormData>(
    async (_prevState, formData) => createStaffUser(formData),
    undefined,
  );
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "STAFF">("STAFF");

  return (
    <Card>
      {state?.generatedPassword ? (
        <div className="animate-in flex items-start gap-3 rounded-lg border border-[var(--success)]/20 bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success-soft-text)]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
          <div>
            <p className="font-medium">Account created.</p>
            <p className="mt-1">
              Password: <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono">{state.generatedPassword}</code>
            </p>
            <p className="mt-1 text-xs opacity-90">Shown once, it&apos;s stored only as a hash. Pass it to them securely now.</p>
          </div>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && (
            <p className="animate-in rounded-lg border border-red-100 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">
              {state.error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Name</span>
              <input type="text" name="name" required className="rounded-md border border-zinc-300 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Email</span>
              <input type="email" name="email" required className="rounded-md border border-zinc-300 px-3 py-2" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Role</span>
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="rounded-md border border-zinc-300 px-3 py-2"
              >
                <option value="STAFF">Staff (one venue)</option>
                <option value="MANAGER">Manager (every venue)</option>
                <option value="OWNER">Owner (every venue)</option>
              </select>
            </label>
            {role === "STAFF" && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Venue</span>
                <select name="venueId" required className="rounded-md border border-zinc-300 px-3 py-2">
                  <option value="">Select a venue…</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div>
            <button type="submit" disabled={pending} className={buttonStyles("primary", "md")}>
              {pending ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
