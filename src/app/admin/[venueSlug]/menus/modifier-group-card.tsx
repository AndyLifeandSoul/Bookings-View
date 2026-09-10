"use client";

import { useActionState } from "react";
import {
  updateModifierGroup,
  deleteModifierGroup,
  createModifierOption,
  updateModifierOption,
  deleteModifierOption,
} from "./actions";
import type { ActionResult } from "@/components/action-form";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface OptionForCard {
  id: string;
  name: string;
  priceDeltaPence: number;
  sortOrder: number;
  active: boolean;
}

/**
 * One ModifierGroup ("Toppings", "Cheese", ...) and every ModifierOption
 * under it, editable in place. Nested rather than a separate options page -
 * a group with no options yet is useless on any item's customisation
 * wizard, so seeing and adding its options right where the group itself is
 * managed keeps the whole "build one customisation group" task on one
 * screen instead of spread across navigation.
 */
export function ModifierGroupCard({
  id,
  venueId,
  name,
  active,
  options,
  itemCount,
}: {
  id: string;
  venueId: string;
  name: string;
  active: boolean;
  options: OptionForCard[];
  /** How many menu items currently use this group as a step - shown so staff know why a delete might be blocked, without needing to click delete first to find out. */
  itemCount: number;
}) {
  const [groupState, groupAction, groupPending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => updateModifierGroup(formData),
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteModifierGroup(formData),
    undefined,
  );

  const sortedOptions = [...options].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <form action={groupAction} className="flex flex-1 flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="venueId" value={venueId} />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Group name</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={name}
              className="w-48 rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-semibold"
            />
          </label>
          <label className="flex items-center gap-1.5 pb-1.5">
            <input type="checkbox" name="active" defaultChecked={active} className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-xs font-medium text-zinc-500">Active</span>
          </label>
          <span className="pb-1.5 text-xs text-zinc-400">
            on {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <button type="submit" disabled={groupPending} className={buttonStyles("secondary", "sm")}>
            {groupPending ? "Saving…" : "Save"}
          </button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="venueId" value={venueId} />
          <button
            type="submit"
            disabled={deletePending}
            className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            {deletePending ? "Removing…" : "Remove group"}
          </button>
        </form>
      </div>
      {(groupState?.error || deleteState?.error) && (
        <p className="text-sm text-[var(--danger-soft-text)]">{groupState?.error ?? deleteState?.error}</p>
      )}

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Options customers choose from within this step
        </p>
        {sortedOptions.length === 0 ? (
          <p className="text-sm text-zinc-400">No options yet - add one below.</p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-50">
            {sortedOptions.map((option) => (
              <ModifierOptionRow key={option.id} groupId={id} venueId={venueId} {...option} />
            ))}
          </div>
        )}

        <ActionForm action={createModifierOption} className="mt-2 flex flex-wrap items-end gap-3">
          <input type="hidden" name="groupId" value={id} />
          <input type="hidden" name="venueId" value={venueId} />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Option name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Cheddar"
              className="w-36 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Extra cost (£)</span>
            <input
              type="number"
              name="priceDeltaPounds"
              min={0}
              step={0.01}
              defaultValue={0}
              className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Order</span>
            <input
              type="number"
              name="sortOrder"
              defaultValue={sortedOptions.length}
              className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <SubmitButton label="Add option" pendingLabel="Adding…" className={buttonStyles("primary", "sm")} />
        </ActionForm>
      </div>
    </Card>
  );
}

function ModifierOptionRow({
  id,
  groupId,
  venueId,
  name,
  priceDeltaPence,
  sortOrder,
  active,
}: OptionForCard & { groupId: string; venueId: string }) {
  const [updateState, updateAction, updatePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => updateModifierOption(formData),
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => deleteModifierOption(formData),
    undefined,
  );

  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      <form action={updateAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="venueId" value={venueId} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={name}
            className="w-36 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Extra cost (£)</span>
          <input
            type="number"
            name="priceDeltaPounds"
            min={0}
            step={0.01}
            defaultValue={(priceDeltaPence / 100).toFixed(2)}
            className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Order</span>
          <input
            type="number"
            name="sortOrder"
            defaultValue={sortOrder}
            className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 pb-1.5">
          <input type="checkbox" name="active" defaultChecked={active} className="h-4 w-4 rounded border-zinc-300" />
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
          {deletePending ? "Removing…" : "Remove"}
        </button>
      </form>
      {(updateState?.error || deleteState?.error) && (
        <p className="text-xs text-[var(--danger-soft-text)]">{updateState?.error ?? deleteState?.error}</p>
      )}
    </div>
  );
}
