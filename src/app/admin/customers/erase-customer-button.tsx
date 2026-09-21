"use client";

import { useActionState, useState } from "react";
import { eraseCustomer } from "./actions";
import type { ActionResult } from "@/components/action-form";

/**
 * Two-step inline confirm for the irreversible GDPR erasure. Deliberately
 * not a window.confirm() dialog (those are easy to click through and don't
 * read well): the first click reveals a Confirm/Cancel pair, so erasing
 * always takes a second, deliberate click. On success the row is refreshed
 * away (the booking resurfaces as "Deleted customer"); on failure the
 * action's error is surfaced beneath the row's controls.
 */
export function EraseCustomerButton({
  email,
  phone,
  name,
}: {
  email: string | null;
  phone: string | null;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => eraseCustomer(formData),
    undefined,
  );

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800"
      >
        Erase
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="email" value={email ?? ""} />
      <input type="hidden" name="phone" value={phone ?? ""} />
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">Erase {name}&apos;s data permanently?</span>
        <button
          type="submit"
          disabled={pending}
          className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50"
        >
          {pending ? "Erasing…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="text-sm text-zinc-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-zinc-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {state?.error && <span className="text-xs text-[var(--danger)]">{state.error}</span>}
    </form>
  );
}
