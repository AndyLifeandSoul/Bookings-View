"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { updateMenu } from "../actions";
import { MenuKioskPreview, type KioskPreviewItem } from "../menu-kiosk-preview";

/**
 * Same live-preview treatment as the New menu screen (Andy asked for it
 * there first, then wanted it here too since this is where a menu's real
 * items actually live) - the preview reflects this menu's real active
 * items, so unlike New menu's always-empty preview, tapping a category
 * here shows what's actually on it today.
 */
export function EditMenuForm({
  menuId,
  venueId,
  name: initialName,
  description,
  active: initialActive,
  bookingTypeId,
  bookingTypes,
  categories,
  availableCategoryIds: initialAvailableCategoryIds,
  items,
}: {
  menuId: string;
  venueId: string;
  name: string;
  description: string | null;
  active: boolean;
  bookingTypeId: string | null;
  bookingTypes: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  availableCategoryIds: string[];
  items: KioskPreviewItem[];
}) {
  const [name, setName] = useState(initialName);
  const [active, setActive] = useState(initialActive);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(() => new Set(initialAvailableCategoryIds));

  function toggleCategory(id: string, checked: boolean) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const previewCategories = categories.filter((category) => selectedCategoryIds.has(category.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
      <ActionForm action={updateMenu} className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-sm)]">
        <input type="hidden" name="id" value={menuId} />
        <input type="hidden" name="venueId" value={venueId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Name</span>
            <input
              type="text"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Linked booking type</span>
            <select name="bookingTypeId" defaultValue={bookingTypeId ?? ""} className="rounded-md border border-zinc-300 px-3 py-2">
              <option value="">Any</option>
              {bookingTypes.map((bt) => (
                <option key={bt.id} value={bt.id}>
                  {bt.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Description (optional)</span>
          <textarea name="description" defaultValue={description ?? ""} rows={2} className="rounded-md border border-zinc-300 px-3 py-2" />
        </label>

        {categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Available categories</span>
            <p className="text-xs text-zinc-500">Which sections this menu offers - untick any this menu shouldn&apos;t use.</p>
            <div className="flex flex-col gap-1.5 pt-1">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={category.id}
                    checked={selectedCategoryIds.has(category.id)}
                    onChange={(e) => toggleCategory(category.id, e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          <span className="text-sm font-medium text-zinc-700">Active</span>
        </label>
        <div className="flex items-center gap-4">
          <SubmitButton label="Save menu" pendingLabel="Saving…" className={buttonStyles("primary", "md")} />
        </div>
      </ActionForm>

      <div className="lg:sticky lg:top-6">
        <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Customer preview</p>
        <MenuKioskPreview menuName={name.trim() || "Menu name"} categories={previewCategories} items={items} />
        <p className={`mt-2 text-xs ${active ? "text-zinc-500" : "text-amber-600"}`}>
          {active
            ? "This is what customers see first when they open their pre-order link."
            : "Inactive - hidden from customers until you switch this on."}
        </p>
      </div>
    </div>
  );
}
