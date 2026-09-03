"use client";

import { useActionState } from "react";
import { deleteMenuItem, updateMenuItem } from "./actions";
import type { ActionResult } from "@/components/action-form";
import type { MenuItem } from "@/generated/prisma";

export function MenuItemRow({ item, menuId }: { item: MenuItem; menuId: string }) {
  const [updateState, updateAction, updatePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => updateMenuItem(formData),
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteMenuItem(formData),
    undefined,
  );

  return (
    <tr className="border-b border-zinc-100 align-top last:border-0">
      <td colSpan={5} className="px-4 py-3">
        <form action={updateAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="menuId" value={menuId} />
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
          <label className="flex items-center gap-1.5 pb-1.5">
            <input type="checkbox" name="active" defaultChecked={item.active} className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-xs font-medium text-zinc-500">Active</span>
          </label>
          <button
            type="submit"
            disabled={updatePending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {updatePending ? "Saving…" : "Save"}
          </button>
          <button
            type="submit"
            formAction={deleteAction}
            disabled={deletePending}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 underline hover:text-red-800 disabled:opacity-50"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </form>
        {updateState?.error && <p className="mt-1.5 text-xs text-red-600">{updateState.error}</p>}
        {deleteState?.error && <p className="mt-1.5 text-xs text-amber-700">{deleteState.error}</p>}
      </td>
    </tr>
  );
}
