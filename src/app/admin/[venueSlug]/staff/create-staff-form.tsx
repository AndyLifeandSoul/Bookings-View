"use client";

import { useActionState, useState } from "react";
import { createStaffUser, type CreateStaffResult } from "./actions";
import type { VenueOption } from "@/lib/venues/list-active-venues";

export function CreateStaffForm({ venues }: { venues: VenueOption[] }) {
  const [state, formAction, pending] = useActionState<CreateStaffResult, FormData>(
    async (_prevState, formData) => createStaffUser(formData),
    undefined,
  );
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "STAFF">("STAFF");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      {state?.generatedPassword ? (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-medium">Account created.</p>
          <p className="mt-1">
            Password: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{state.generatedPassword}</code>
          </p>
          <p className="mt-1 text-xs text-green-800">
            Shown once — it&apos;s stored only as a hash. Pass it to them securely now.
          </p>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
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
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
