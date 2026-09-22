"use client";

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Click-a-swatch colour picker, matching DMN's booking-type colour row,
 * instead of a raw hex input. Submits the chosen colour through a hidden
 * field (`name`), so it drops straight into the existing form/action with
 * no wiring change. The palette is a fixed, legible set that reads well as
 * a diary block stripe.
 */
const PALETTE = [
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#e11d48",
  "#ec4899",
  "#a855f7",
  "#7c3aed",
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#06b6d4",
  "#10b981",
  "#16a34a",
  "#84cc16",
  "#64748b",
];

export function ColorSwatchPicker({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const initial = defaultValue && /^#[0-9a-fA-F]{6}$/.test(defaultValue) ? defaultValue.toLowerCase() : PALETTE[0];
  const [value, setValue] = useState(initial);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((color) => {
          const selected = color === value;
          return (
            <button
              key={color}
              type="button"
              onClick={() => setValue(color)}
              aria-label={`Choose colour ${color}`}
              aria-pressed={selected}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-transform hover:scale-110 ${
                selected ? "ring-2 ring-zinc-900 ring-offset-1" : "ring-1 ring-inset ring-black/10"
              }`}
              style={{ backgroundColor: color }}
            >
              {selected && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
