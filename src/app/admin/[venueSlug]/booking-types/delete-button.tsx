"use client";

import { useActionState } from "react";
import { deleteBookingType } from "./actions";
import type { ActionResult } from "@/components/action-form";

/**
 * Its own small component (not the shared ActionForm) because the message
 * that comes back on a "can't delete, deactivated instead" outcome isn't an
 * error to alarm over — it's confirmation the action did something sane —
 * so it renders inline next to the row rather than as a red banner.
 */
export function DeleteBookingTypeButton({ id, name, venueId }: { id: string; name: string; venueId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteBookingType(formData),
    undefined,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Delete "${name}"? This can't be undone.`)) e.preventDefault();
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
