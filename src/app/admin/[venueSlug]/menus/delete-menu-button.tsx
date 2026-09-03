"use client";

import { useActionState } from "react";
import { deleteMenu } from "./actions";
import type { ActionResult } from "@/components/action-form";

export function DeleteMenuButton({ id, name, venueId }: { id: string; name: string; venueId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteMenu(formData),
    undefined,
  );

  return (
    <div className="mt-3">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Delete "${name}"? This can't be undone.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="venueId" value={venueId} />
        <button type="submit" disabled={pending} className="text-sm text-red-600 underline hover:text-red-800 disabled:opacity-50">
          {pending ? "Deleting…" : `Delete ${name}`}
        </button>
      </form>
      {state?.error && <p className="mt-1.5 text-xs text-amber-700">{state.error}</p>}
    </div>
  );
}
