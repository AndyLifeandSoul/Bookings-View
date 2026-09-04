"use client";

import { useState } from "react";
import { buttonStyles } from "@/components/ui/button";

export interface TableOption {
  id: string;
  label: string;
  areaId: string | null;
}

/**
 * The Tables checkbox grid on the booking details page, plus a one-click
 * helper for BookingType.tableFillMode WHOLE_AREA/WHOLE_VENUE types — see
 * that field's doc comment in schema.prisma. Andy: "Area Hire can use any
 * area and automatically reserves every table in that area" and "Private
 * Hire automatically uses every table in the venue regardless of booking
 * size" — staff still submit the form and can hand-adjust afterwards (a
 * table under maintenance, say), this just saves ticking every box
 * one by one.
 *
 * Plain HTML checkboxes would do for PER_BOOKING (see every other checkbox
 * list in this app), but the fill-area/select-all buttons need to drive the
 * checked state programmatically, which means controlled inputs — hence a
 * client component here specifically, unlike the rest of this form.
 */
export function TableSelectionFields({
  tables,
  areas,
  initialSelectedIds,
  tableFillMode,
}: {
  tables: TableOption[];
  areas: { id: string; name: string }[];
  initialSelectedIds: string[];
  /** BookingType.tableFillMode for this booking's type — "PER_BOOKING" shows plain checkboxes, no extra controls. */
  tableFillMode: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [areaChoice, setAreaChoice] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function fillArea() {
    if (!areaChoice) return;
    setSelected(new Set(tables.filter((t) => t.areaId === areaChoice).map((t) => t.id)));
  }

  function selectAll() {
    setSelected(new Set(tables.map((t) => t.id)));
  }

  return (
    <div className="flex flex-col gap-3">
      {tableFillMode === "WHOLE_AREA" && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 p-3">
          <span className="text-sm text-zinc-700">Fill a whole area:</span>
          <select
            value={areaChoice}
            onChange={(e) => setAreaChoice(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="">Select an area…</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={fillArea} disabled={!areaChoice} className={buttonStyles("secondary", "sm")}>
            Fill this area&apos;s tables
          </button>
        </div>
      )}

      {tableFillMode === "WHOLE_VENUE" && (
        <div className="flex items-center gap-2 rounded-md bg-zinc-50 p-3">
          <button type="button" onClick={selectAll} className={buttonStyles("secondary", "sm")}>
            Select every table
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tables.map((table) => (
          <label
            key={table.id}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              selected.has(table.id)
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
            }`}
          >
            <input
              type="checkbox"
              name="tableIds"
              value={table.id}
              checked={selected.has(table.id)}
              onChange={() => toggle(table.id)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            {table.label}
          </label>
        ))}
      </div>
    </div>
  );
}
