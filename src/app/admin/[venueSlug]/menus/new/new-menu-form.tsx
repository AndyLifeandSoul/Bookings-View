"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { createMenu } from "../actions";

/**
 * Andy asked for a live preview next to the new-menu form so the kiosk
 * header a customer actually sees updates as he types, instead of having
 * to save the menu and open the customer link to check it. The preview's
 * state is separate from the form's own submission: every input still
 * posts through the normal ActionForm/server-action path (name/active/
 * selected categories are controlled only so the preview can mirror them
 * - a controlled input's current value is still what FormData(form) reads
 * at submit time, so this changes nothing about how the menu is saved).
 * Category tiles shown here are the venue's real categories, never
 * invented placeholders - an empty venue just gets a note that categories
 * will appear once added.
 *
 * Every category starts checked (Andy's spec: "all categories added by
 * default"), matching what createMenu actually does with an untouched
 * selector - unchecking one is what narrows this menu down.
 */
export function NewMenuForm({
  venueId,
  bookingTypes,
  categories,
}: {
  venueId: string;
  bookingTypes: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(() => new Set(categories.map((c) => c.id)));

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
      <ActionForm
        action={createMenu}
        className="flex flex-col gap-5 rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-sm)]"
      >
        <input type="hidden" name="venueId" value={venueId} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            type="text"
            name="name"
            required
            placeholder="Bottomless Brunch Menu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Description (optional)</span>
          <textarea name="description" rows={2} className="rounded-md border border-zinc-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Linked booking type</span>
          <select name="bookingTypeId" defaultValue="" className="rounded-md border border-zinc-300 px-3 py-2">
            <option value="">Any</option>
            {bookingTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {bt.name}
              </option>
            ))}
          </select>
        </label>

        {categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Available categories</span>
            <p className="text-xs text-zinc-500">
              Which sections this menu offers - every category starts selected, untick any this menu shouldn&apos;t
              use (e.g. a set lunch menu with no Desserts).
            </p>
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
        <div>
          <SubmitButton label="Create menu" pendingLabel="Creating…" className={buttonStyles("primary", "md")} />
        </div>
      </ActionForm>

      <div className="lg:sticky lg:top-6">
        <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Customer preview</p>
        <div className="rounded-[28px] border border-zinc-300 bg-zinc-900 p-2 [box-shadow:var(--shadow-md)]">
          <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                {name.trim() || "Menu name"}
              </p>
              <h2 className="mt-1 text-lg font-bold text-zinc-900">What would you like to order?</h2>
              <p className="mt-1 text-xs text-zinc-500">Tap a category to get started</p>
            </div>

            {previewCategories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {previewCategories.slice(0, 4).map((category) => (
                  <div
                    key={category.id}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-4 text-sm font-semibold text-zinc-900"
                  >
                    {category.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                {categories.length === 0
                  ? "Categories you add will show here as tiles."
                  : "No categories selected - customers won't see any sections until you tick some above."}
              </p>
            )}

            <div className="rounded-xl bg-zinc-100 px-4 py-2.5 text-center text-xs text-zinc-400">
              Your basket is empty
            </div>
          </div>
        </div>
        <p className={`mt-2 text-xs ${active ? "text-zinc-500" : "text-amber-600"}`}>
          {active
            ? "This is what customers will see first when they open their pre-order link."
            : "Inactive - hidden from customers until you switch this on."}
        </p>
      </div>
    </div>
  );
}
