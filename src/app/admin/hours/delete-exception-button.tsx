"use client";

import { useActionState } from "react";
import { deleteException } from "./actions";
import type { ActionResult } from "@/components/action-form";

export function DeleteExceptionButton({ id }: { id: string }) {
  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteException(formData),
    undefined,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-sm text-red-600 underline hover:text-red-800 disabled:opacity-50">
        {pending ? "Removing…" : "Remove"}
      </button>
    </form>
  );
}
