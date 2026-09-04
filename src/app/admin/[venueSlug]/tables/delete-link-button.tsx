"use client";

import { useActionState } from "react";
import { deleteTableLink } from "./actions";
import type { ActionResult } from "@/components/action-form";

export function DeleteLinkButton({ id, venueId }: { id: string; venueId: string }) {
  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteTableLink(formData),
    undefined,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="venueId" value={venueId} />
      <button type="submit" disabled={pending} className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50">
        {pending ? "Removing…" : "Unlink"}
      </button>
    </form>
  );
}
