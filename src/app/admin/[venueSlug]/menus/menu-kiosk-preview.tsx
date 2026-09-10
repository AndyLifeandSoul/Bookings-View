"use client";

import { useState } from "react";

export interface KioskPreviewItem {
  id: string;
  name: string;
  description: string | null;
  priceInPence: number;
  dietaryTags: string[];
  categoryId: string | null;
  customisable: boolean;
}

/**
 * A small, clickable replica of the customer-facing pre-order kiosk
 * (see lifeandsoul-bookings' pre-order-kiosk.tsx - same category tiles,
 * same item-card look) so staff can check what they're building without
 * leaving the admin screen. Andy's spec: tapping a category tile here
 * opens that category's items, same as the real kiosk. Deliberately
 * scoped to category -> items browsing only, no wizard/basket - this is a
 * look-and-feel check, not a second implementation of checkout.
 *
 * Shared between the New menu and menu-edit screens: New menu has no
 * items yet (a fresh menu has none to show), so it's passed an empty
 * items array and every category just shows "No items yet"; editing an
 * existing menu passes its real active items.
 */
export function MenuKioskPreview({
  menuName,
  categories,
  items,
}: {
  menuName: string;
  categories: { id: string; name: string }[];
  items: KioskPreviewItem[];
}) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const openCategory = openCategoryId ? categories.find((c) => c.id === openCategoryId) : undefined;

  return (
    <div className="rounded-[28px] border border-zinc-300 bg-zinc-900 p-2 [box-shadow:var(--shadow-md)]">
      <div className="flex min-h-[280px] flex-col gap-5 rounded-[20px] bg-white p-5">
        {openCategory ? (
          <>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setOpenCategoryId(null)}
                aria-label="Back"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 5 8 12l7 7" />
                </svg>
              </button>
              <h3 className="text-base font-bold text-zinc-900">{openCategory.name}</h3>
            </div>

            <div className="flex flex-col gap-2">
              {items.filter((item) => item.categoryId === openCategory.id).length === 0 ? (
                <p className="text-xs text-zinc-400">No items in this category yet.</p>
              ) : (
                items
                  .filter((item) => item.categoryId === openCategory.id)
                  .map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 rounded-lg p-2.5 ${
                        item.customisable ? "border-2 border-zinc-900" : "border border-zinc-200"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-900">{item.name}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-zinc-600">
                          {item.customisable ? "from " : ""}&pound;{(item.priceInPence / 100).toFixed(2)}
                          {item.dietaryTags.length > 0 && (
                            <span className="text-zinc-400"> &middot; {item.dietaryTags.join(", ")}</span>
                          )}
                        </p>
                      </div>
                      {item.customisable ? (
                        <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-1 text-[9px] font-semibold text-white">Customise</span>
                      ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-xs text-zinc-500">
                          +
                        </span>
                      )}
                    </div>
                  ))
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{menuName}</p>
              <h2 className="mt-1 text-lg font-bold text-zinc-900">What would you like to order?</h2>
              <p className="mt-1 text-xs text-zinc-500">Tap a category to get started</p>
            </div>

            {categories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setOpenCategoryId(category.id)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-4 text-left text-sm font-semibold text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                No categories to show yet - add some in the Categories section, or tick some above.
              </p>
            )}
          </>
        )}

        <div className="mt-auto rounded-lg bg-zinc-100 px-3 py-2 text-center text-[11px] text-zinc-400">
          Your basket is empty
        </div>
      </div>
    </div>
  );
}
