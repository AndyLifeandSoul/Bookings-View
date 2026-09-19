"use client";

import { useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { attachItemsToMenu } from "../actions";

/**
 * Ticks one or more of the venue's existing items onto this menu in a
 * single submit, instead of the old one-dropdown-per-submit flow - the
 * tedious part when building a brand new menu from scratch. Select
 * all/Clear just flips every checkbox's DOM state directly rather than
 * threading controlled state through each one; the actual submit still
 * reads whatever's checked via plain form data (menuItemIds).
 */
export function AttachItemsForm({
  menuId,
  venueId,
  items,
}: {
  menuId: string;
  venueId: string;
  items: { id: string; name: string }[];
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function setAll(checked: boolean) {
    listRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
      box.checked = checked;
    });
  }

  return (
    <ActionForm action={attachItemsToMenu} className="flex flex-col gap-3">
      <input type="hidden" name="menuId" value={menuId} />
      <input type="hidden" name="venueId" value={venueId} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-700">Add items to this menu</span>
        <div className="flex gap-3 text-xs font-medium text-zinc-500">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="underline-offset-2 hover:text-zinc-700 hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="underline-offset-2 hover:text-zinc-700 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>
      <div ref={listRef} className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="menuItemIds" value={item.id} className="h-4 w-4 rounded border-zinc-300" />
            {item.name}
          </label>
        ))}
      </div>
      <div>
        <SubmitButton label="Add selected items" pendingLabel="Adding…" className={buttonStyles("primary", "md")} />
      </div>
    </ActionForm>
  );
}
