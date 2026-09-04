"use client";

import { useActionState } from "react";
import { toggleStaffActive, resetStaffPassword, type CreateStaffResult } from "./actions";
import type { ActionResult } from "@/components/action-form";

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => toggleStaffActive(formData),
    undefined,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={`text-sm font-medium underline decoration-dotted underline-offset-2 transition-colors disabled:opacity-50 ${
          active ? "text-[var(--danger)] hover:text-red-800" : "text-[var(--success-soft-text)] hover:text-green-900"
        }`}
      >
        {pending ? "…" : active ? "Deactivate" : "Reactivate"}
      </button>
    </form>
  );
}

export function ResetPasswordButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<CreateStaffResult, FormData>(
    async (_prevState, formData) => resetStaffPassword(formData),
    undefined,
  );

  if (state?.generatedPassword) {
    return (
      <span className="animate-in text-xs">
        New password: <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono">{state.generatedPassword}</code>
      </span>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-medium text-zinc-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)] disabled:opacity-50"
      >
        {pending ? "…" : "Reset password"}
      </button>
    </form>
  );
}
