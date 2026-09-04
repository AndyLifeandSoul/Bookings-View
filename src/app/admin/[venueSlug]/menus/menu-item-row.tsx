"use client";

import { useActionState } from "react";
import { deleteMenuItem, updateMenuItem } from "./actions";
import type { ActionResult } from "@/components/action-form";
import type { MenuItem } from "@/generated/prisma";
import { buttonStyles } from "@/components/ui/button";

export function MenuItemRow({
  item,
  menuId,
  venueId,
  categories,
}: {
  item: MenuItem;
  menuId: string;
  venueId: string;
  categories: { id: string; name: string }[];
}) {
  const [updateState, updateAction, updatePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => updateMenuItem(formData),
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteMenuItem(formData),
    undefined,
  );

  return (
    <tr className="border-b border-zinc-50 align-top transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
      <td colSpan={5} className="px-4 py-3">
        <form action={updateAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="menuId" value={menuId} />
          <input type="hidden" name="venueId" value={venueId} />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Name</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={item.name}
              className="w-44 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Description</span>
            <input
              type="text"
              name="description"
              defaultValue={item.description ?? ""}
              className="w-56 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Price (£)</span>
            <input
              type="number"
              name="pricePounds"
              min={0}
              step={0.01}
              required
              defaultValue={(item.priceInPence / 100).toFixed(2)}
              className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Dietary tags</span>
            <input
              type="text"
              name="dietaryTags"
              defaultValue={item.dietaryTags.join(", ")}
              placeholder="vegetarian, gf"
              className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Category</span>
            <select
              name="categoryId"
              defaultValue={item.categoryId ?? ""}
              className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-1.5">
            <input type="checkbox" name="active" defaultChecked={item.active} className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-xs font-medium text-zinc-500">Active</span>
          </label>
          <button type="submit" disabled={updatePending} className={buttonStyles("secondary", "sm")}>
            {updatePending ? "Saving…" : "Save"}
          </button>
          <button
            type="submit"
            formAction={deleteAction}
            disabled={deletePending}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </form>
        {updateState?.error && <p className="mt-1.5 text-xs text-[var(--danger-soft-text)]">{updateState.error}</p>}
        {deleteState?.error && <p className="mt-1.5 text-xs text-[var(--warning-soft-text)]">{deleteState.error}</p>}
      </td>
    </tr>
  );
}
