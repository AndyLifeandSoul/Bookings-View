"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/components/action-form";

/** A small "Delete" link that asks first, posts the hidden fields to a server action, and shows any error beside it. */
export function ConfirmDeleteButton({
  action,
  fields,
  confirmText,
  label = "Delete",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  confirmText: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(async (_prev, fd) => action(fd), undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 hover:text-red-800 disabled:opacity-50"
      >
        {pending ? "Deleting..." : label}
      </button>
      {state?.error && <p className="max-w-[16rem] text-right text-xs text-[var(--danger)]">{state.error}</p>}
    </form>
  );
}
