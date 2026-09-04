"use client";

import { useActionState } from "react";
import { deleteTable } from "./actions";
import type { ActionResult } from "@/components/action-form";

/** Same "deactivated instead of deleted" pattern as DeleteBookingTypeButton — see that component's doc comment. */
export function DeleteTableButton({ id, label, venueId }: { id: string; label: string; venueId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteTable(formData),
    undefined,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Delete table "${label}"? This can't be undone.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="venueId" value={venueId} />
        <button type="submit" disabled={pending} className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50">
          {pending ? "Deleting…" : "Delete"}
        </button>
      </form>
      {state?.error && <p className="max-w-[16rem] text-right text-xs text-[var(--warning-soft-text)]">{state.error}</p>}
    </div>
  );
}
