"use client";

import { useActionState } from "react";
import { updateMenuCategory, deleteMenuCategory } from "./actions";
import type { ActionResult } from "@/components/action-form";
import { buttonStyles } from "@/components/ui/button";

/**
 * Same inline edit-in-place shape as AreaRow (tables/area-row.tsx) - name +
 * a sort order number, simple enough that a separate edit page would be
 * overkill. No confirmation on delete (unlike menus/menu items): removing
 * a category only un-categorises whatever items pointed at it, see
 * deleteMenuCategory's doc comment.
 */
export function MenuCategoryRow({
  id,
  venueId,
  name,
  sortOrder,
  itemCount,
}: {
  id: string;
  venueId: string;
  name: string;
  sortOrder: number;
  itemCount: number;
}) {
  const [editState, editAction, editPending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => updateMenuCategory(formData),
    undefined,
  );
  const [, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteMenuCategory(formData),
    undefined,
  );

  return (
    <div className="flex flex-col gap-2 border-b border-zinc-50 px-4 py-3 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40 sm:flex-row sm:items-center sm:gap-4">
      <form action={editAction} className="flex flex-1 flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="venueId" value={venueId} />
        <label className="flex flex-1 flex-col gap-1 sm:min-w-[10rem]">
          <span className="text-xs font-medium text-zinc-500">Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={name}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Order</span>
          <input
            type="number"
            name="sortOrder"
            defaultValue={sortOrder}
            className="w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </label>
        <span className="pt-4 text-xs text-zinc-400">
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
        <button type="submit" disabled={editPending} className={buttonStyles("secondary", "sm", "mt-4")}>
          {editPending ? "Saving…" : "Save"}
        </button>
      </form>
      {editState?.error && <p className="text-sm text-[var(--danger-soft-text)]">{editState.error}</p>}
      <form action={deleteAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="venueId" value={venueId} />
        <button
          type="submit"
          disabled={deletePending}
          className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50"
        >
          {deletePending ? "Removing…" : "Remove"}
        </button>
      </form>
    </div>
  );
}
