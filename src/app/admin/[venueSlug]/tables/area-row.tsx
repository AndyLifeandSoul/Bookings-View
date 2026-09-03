"use client";

import { useActionState } from "react";
import { updateArea, deleteArea } from "./actions";
import type { ActionResult } from "@/components/action-form";

/**
 * Areas are simple enough (name + priority) that inline edit-in-place beats
 * a separate edit page — but each row needs its own independent Save, and a
 * <form> can't cleanly wrap table rows/cells, so this section is laid out as
 * flex rows rather than an actual <table> (see the Tables section below,
 * which uses a real table + a separate /tables/[id] edit page instead, since
 * a table has enough fields that inline editing would get cramped).
 */
export function AreaRow({
  id,
  venueId,
  name,
  priority,
  tableCount,
}: {
  id: string;
  venueId: string;
  name: string;
  priority: number;
  tableCount: number;
}) {
  const [editState, editAction, editPending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => updateArea(formData),
    undefined,
  );
  const [, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteArea(formData),
    undefined,
  );

  return (
    <div className="flex flex-col gap-2 border-b border-zinc-100 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
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
          <span className="text-xs font-medium text-zinc-500">Priority (fills first, ascending)</span>
          <input
            type="number"
            name="priority"
            defaultValue={priority}
            className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </label>
        <span className="pt-4 text-xs text-zinc-400">
          {tableCount} table{tableCount === 1 ? "" : "s"}
        </span>
        <button
          type="submit"
          disabled={editPending}
          className="mt-4 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {editPending ? "Saving…" : "Save"}
        </button>
      </form>
      {editState?.error && <p className="text-sm text-red-700">{editState.error}</p>}
      <form action={deleteAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="venueId" value={venueId} />
        <button
          type="submit"
          disabled={deletePending}
          className="text-sm text-red-600 underline hover:text-red-800 disabled:opacity-50"
        >
          {deletePending ? "Removing…" : "Remove"}
        </button>
      </form>
    </div>
  );
}
