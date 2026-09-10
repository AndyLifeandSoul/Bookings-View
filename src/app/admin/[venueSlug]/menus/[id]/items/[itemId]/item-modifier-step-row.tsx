"use client";

import { useActionState } from "react";
import { updateModifierGroupSequence, detachModifierGroupFromItem } from "../../../actions";
import type { ActionResult } from "@/components/action-form";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ItemModifierStepRow({
  id,
  menuItemId,
  venueId,
  groupName,
  groupActive,
  sequence,
}: {
  id: string;
  menuItemId: string;
  venueId: string;
  groupName: string;
  groupActive: boolean;
  sequence: number;
}) {
  const [updateState, updateAction, updatePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => updateModifierGroupSequence(formData),
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => detachModifierGroupFromItem(formData),
    undefined,
  );

  return (
    <div className="flex flex-col gap-1.5 border-b border-zinc-50 px-4 py-3 last:border-0">
      <form action={updateAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menuItemId" value={menuItemId} />
        <input type="hidden" name="venueId" value={venueId} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Order</span>
          <input
            type="number"
            name="sequence"
            min={1}
            defaultValue={sequence}
            className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <span className="pb-1.5 text-sm font-medium text-zinc-900">
          {groupName}
          {!groupActive && (
            <Badge variant="neutral" className="ml-2">
              Inactive
            </Badge>
          )}
        </span>
        <button type="submit" disabled={updatePending} className={buttonStyles("secondary", "sm")}>
          {updatePending ? "Saving…" : "Save order"}
        </button>
        <button
          type="submit"
          formAction={deleteAction}
          disabled={deletePending}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50"
        >
          {deletePending ? "Removing…" : "Remove step"}
        </button>
      </form>
      {(updateState?.error || deleteState?.error) && (
        <p className="text-xs text-[var(--danger-soft-text)]">{updateState?.error ?? deleteState?.error}</p>
      )}
    </div>
  );
}
