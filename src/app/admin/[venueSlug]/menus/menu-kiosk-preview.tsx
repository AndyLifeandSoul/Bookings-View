"use client";

import { useState } from "react";

export interface KioskPreviewModifierOption {
  id: string;
  name: string;
  priceDeltaPence: number;
}

export interface KioskPreviewModifierGroup {
  id: string;
  name: string;
  options: KioskPreviewModifierOption[];
}

export interface KioskPreviewItem {
  id: string;
  name: string;
  description: string | null;
  priceInPence: number;
  dietaryTags: string[];
  categoryId: string | null;
  modifierGroups: { sequence: number; group: KioskPreviewModifierGroup }[];
}

interface BasketLineModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaPence: number;
}

interface BasketLine {
  key: string;
  menuItemId: string;
  name: string;
  basePriceInPence: number;
  modifiers: BasketLineModifier[];
  quantity: number;
}

type Screen =
  | { kind: "categories" }
  | { kind: "items"; categoryId: string | null }
  | { kind: "wizard"; item: KioskPreviewItem; stepIndex: number; selections: BasketLineModifier[] }
  | { kind: "basket" };

function lineKey(menuItemId: string, modifiers: BasketLineModifier[]): string {
  return `${menuItemId}::${[...modifiers.map((m) => m.optionId)].sort().join(",")}`;
}

function lineUnitPricePence(line: BasketLine): number {
  return line.basePriceInPence + line.modifiers.reduce((sum, m) => sum + m.priceDeltaPence, 0);
}

/**
 * A fully working replica of the customer-facing pre-order kiosk (see
 * lifeandsoul-bookings' pre-order-kiosk.tsx - same screens, same state
 * machine, same basket-merging rules) rather than a static mockup, so
 * staff can actually use it while building a menu: browse categories,
 * open an item's customisation wizard, add things to a basket, adjust
 * quantities. Andy's spec exactly: "should function exactly like a
 * customer is using it. The only thing that shouldn't be doable... is
 * checkout" - there is no token and nothing here ever calls the real
 * /api/pre-order endpoint, so submitting is deliberately a no-op that
 * just says so, never a fake "order placed" confirmation.
 *
 * Shared between New menu (no items exist yet, so every category just
 * shows "No items yet" and the wizard/basket are simply unreachable
 * until items exist) and the menu edit screen, which passes the menu's
 * real active items and their real attached ModifierGroup steps.
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
  const [screen, setScreen] = useState<Screen>(categories.length > 0 ? { kind: "categories" } : { kind: "items", categoryId: null });
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [notes, setNotes] = useState("");
  const [checkoutAttempted, setCheckoutAttempted] = useState(false);

  const totalItems = basket.reduce((sum, line) => sum + line.quantity, 0);
  const totalPence = basket.reduce((sum, line) => sum + lineUnitPricePence(line) * line.quantity, 0);

  function addToBasket(menuItemId: string, name: string, basePriceInPence: number, modifiers: BasketLineModifier[]) {
    const key = lineKey(menuItemId, modifiers);
    setBasket((prev) => {
      const existing = prev.find((line) => line.key === key);
      if (existing) return prev.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line));
      return [...prev, { key, menuItemId, name, basePriceInPence, modifiers, quantity: 1 }];
    });
  }

  function setLineQuantity(key: string, quantity: number) {
    setBasket((prev) =>
      quantity <= 0 ? prev.filter((line) => line.key !== key) : prev.map((line) => (line.key === key ? { ...line, quantity } : line)),
    );
  }

  function pickItem(item: KioskPreviewItem) {
    if (item.modifierGroups.length === 0) {
      addToBasket(item.id, item.name, item.priceInPence, []);
      return;
    }
    setScreen({ kind: "wizard", item, stepIndex: 0, selections: [] });
  }

  function pickOption(item: KioskPreviewItem, stepIndex: number, selections: BasketLineModifier[], group: KioskPreviewModifierGroup, option: KioskPreviewModifierOption) {
    const nextSelections = [
      ...selections,
      { groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, priceDeltaPence: option.priceDeltaPence },
    ];
    const steps = [...item.modifierGroups].sort((a, b) => a.sequence - b.sequence);
    if (stepIndex + 1 < steps.length) {
      setScreen({ kind: "wizard", item, stepIndex: stepIndex + 1, selections: nextSelections });
    } else {
      addToBasket(item.id, item.name, item.priceInPence, nextSelections);
      setScreen({ kind: "items", categoryId: item.categoryId });
    }
  }

  function backTo(kind: "categories" | "items") {
    setScreen(kind === "categories" ? { kind: "categories" } : { kind: "items", categoryId: null });
  }

  return (
    <div className="rounded-[28px] border border-zinc-300 bg-zinc-900 p-2 [box-shadow:var(--shadow-md)]">
      <div className="flex h-[520px] flex-col gap-4 overflow-hidden rounded-[20px] bg-white p-4">
        <div className="flex-1 overflow-y-auto pr-0.5">
          {screen.kind === "categories" && (
            <CategoriesScreen menuName={menuName} categories={categories} onPick={(categoryId) => setScreen({ kind: "items", categoryId })} />
          )}

          {screen.kind === "items" && (
            <ItemsScreen
              categoryName={categories.find((c) => c.id === screen.categoryId)?.name ?? menuName}
              showBack={categories.length > 0}
              onBack={() => backTo("categories")}
              items={items.filter((item) => item.categoryId === screen.categoryId)}
              onPick={pickItem}
            />
          )}

          {screen.kind === "wizard" &&
            (() => {
              const steps = [...screen.item.modifierGroups].sort((a, b) => a.sequence - b.sequence);
              const step = steps[screen.stepIndex];
              return (
                <WizardScreen
                  itemName={screen.item.name}
                  selections={screen.selections}
                  stepIndex={screen.stepIndex}
                  stepCount={steps.length}
                  group={step.group}
                  onPick={(option) => pickOption(screen.item, screen.stepIndex, screen.selections, step.group, option)}
                  onBack={() => {
                    if (screen.stepIndex === 0) setScreen({ kind: "items", categoryId: screen.item.categoryId });
                    else setScreen({ kind: "wizard", item: screen.item, stepIndex: screen.stepIndex - 1, selections: screen.selections.slice(0, -1) });
                  }}
                />
              );
            })()}

          {screen.kind === "basket" && (
            <BasketScreen
              basket={basket}
              notes={notes}
              onNotesChange={setNotes}
              onQuantityChange={setLineQuantity}
              onBack={() => backTo(categories.length > 0 ? "categories" : "items")}
              onCheckout={() => setCheckoutAttempted(true)}
              checkoutAttempted={checkoutAttempted}
              totalItems={totalItems}
              totalPence={totalPence}
            />
          )}
        </div>

        {screen.kind !== "basket" && (
          <BasketBar count={totalItems} pence={totalPence} onClick={() => setScreen({ kind: "basket" })} />
        )}
      </div>
    </div>
  );
}

function ChevronBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5 8 12l7 7" />
      </svg>
    </button>
  );
}

function BasketBar({ count, pence, onClick }: { count: number; pence: number; onClick: () => void }) {
  if (count === 0) return <p className="text-center text-[11px] text-zinc-400">Your basket is empty</p>;
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-xl bg-zinc-900 px-3.5 py-2.5 text-left text-white">
      <span className="text-xs font-semibold">
        {count} item{count === 1 ? "" : "s"} &middot; &pound;{(pence / 100).toFixed(2)}
      </span>
      <span className="text-[11px] font-semibold">View basket &rarr;</span>
    </button>
  );
}

function CategoriesScreen({
  menuName,
  categories,
  onPick,
}: {
  menuName: string;
  categories: { id: string; name: string }[];
  onPick: (categoryId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{menuName || "Menu name"}</p>
        <h2 className="mt-1 text-lg font-bold text-zinc-900">What would you like to order?</h2>
        <p className="mt-1 text-xs text-zinc-500">Tap a category to get started</p>
      </div>
      {categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onPick(category.id)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-4 text-left text-sm font-semibold text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400">No categories to show yet - add some in the Categories section, or tick some above.</p>
      )}
    </div>
  );
}

function ItemsScreen({
  categoryName,
  showBack,
  onBack,
  items,
  onPick,
}: {
  categoryName: string;
  showBack: boolean;
  onBack: () => void;
  items: KioskPreviewItem[];
  onPick: (item: KioskPreviewItem) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        {showBack && <ChevronBack onClick={onBack} />}
        <h3 className="text-base font-bold text-zinc-900">{categoryName}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">No items in this category yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const customisable = item.modifierGroups.length > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                className={`flex items-center justify-between gap-2 rounded-lg p-2.5 text-left hover:bg-zinc-50 ${
                  customisable ? "border-2 border-zinc-900" : "border border-zinc-200"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-900">{item.name}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-600">
                    {customisable ? "from " : ""}&pound;{(item.priceInPence / 100).toFixed(2)}
                    {item.dietaryTags.length > 0 && <span className="text-zinc-400"> &middot; {item.dietaryTags.join(", ")}</span>}
                  </p>
                </div>
                {customisable ? (
                  <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-1 text-[9px] font-semibold text-white">Customise</span>
                ) : (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-xs text-zinc-500">+</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WizardScreen({
  itemName,
  selections,
  stepIndex,
  stepCount,
  group,
  onPick,
  onBack,
}: {
  itemName: string;
  selections: BasketLineModifier[];
  stepIndex: number;
  stepCount: number;
  group: KioskPreviewModifierGroup;
  onPick: (option: KioskPreviewModifierOption) => void;
  onBack: () => void;
}) {
  const breadcrumb = [itemName, ...selections.map((s) => s.optionName)].join(" · ");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <ChevronBack onClick={onBack} />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">{breadcrumb}</p>
          <h3 className="text-sm font-bold text-zinc-900">Choose your {group.name.toLowerCase()}</h3>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: stepCount }).map((_, i) => (
          <div key={i} className={`h-1 w-6 rounded-full ${i <= stepIndex ? "bg-zinc-900" : "bg-zinc-200"}`} />
        ))}
        <span className="ml-1.5 text-[10px] text-zinc-500">
          Step {stepIndex + 1} of {stepCount}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {group.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onPick(option)}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left text-xs font-semibold text-zinc-900 hover:border-zinc-900"
          >
            {option.name}
            {option.priceDeltaPence > 0 && <span className="text-[11px] font-semibold text-zinc-500">+&pound;{(option.priceDeltaPence / 100).toFixed(2)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function BasketScreen({
  basket,
  notes,
  onNotesChange,
  onQuantityChange,
  onBack,
  onCheckout,
  checkoutAttempted,
  totalItems,
  totalPence,
}: {
  basket: BasketLine[];
  notes: string;
  onNotesChange: (value: string) => void;
  onQuantityChange: (key: string, quantity: number) => void;
  onBack: () => void;
  onCheckout: () => void;
  checkoutAttempted: boolean;
  totalItems: number;
  totalPence: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <ChevronBack onClick={onBack} />
        <h3 className="text-base font-bold text-zinc-900">Your basket</h3>
      </div>

      {basket.length === 0 ? (
        <p className="text-xs text-zinc-400">Your basket is empty - go back and add something.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {basket.map((line) => (
            <div key={line.key} className="rounded-lg border border-zinc-200 bg-white p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900">{line.name}</p>
                  {line.modifiers.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-zinc-500">{line.modifiers.map((m) => m.optionName).join(" · ")}</p>
                  )}
                </div>
                <p className="shrink-0 text-[11px] font-semibold text-zinc-900">
                  &pound;{((lineUnitPricePence(line) * line.quantity) / 100).toFixed(2)}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(line.key, line.quantity - 1)}
                    aria-label={`Fewer ${line.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    &minus;
                  </button>
                  <span className="w-4 text-center text-[11px] tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(line.key, line.quantity + 1)}
                    aria-label={`More ${line.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onQuantityChange(line.key, 0)}
                  className="text-[10px] font-medium text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="preview-notes" className="text-[11px] font-semibold text-zinc-900">
          Allergies or special requests?
        </label>
        <textarea
          id="preview-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          placeholder="e.g. one guest has a nut allergy"
          className="rounded-md border border-zinc-300 p-2 text-[11px] text-zinc-900 placeholder:text-zinc-400"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-700">
        <span>
          {totalItems} item{totalItems === 1 ? "" : "s"} selected
        </span>
        <span className="font-semibold">&pound;{(totalPence / 100).toFixed(2)}</span>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={totalItems === 0}
        className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        Submit pre-order
      </button>
      {checkoutAttempted && <p className="text-[11px] text-zinc-500">This is a preview - checkout isn&apos;t available here.</p>}
    </div>
  );
}
