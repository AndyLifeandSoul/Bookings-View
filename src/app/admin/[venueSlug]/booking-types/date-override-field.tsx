"use client";

import { useState } from "react";

export interface DateOverrideRow {
  date: string;
  /// "" = no start time set (paired with endTime === "", means "the whole day").
  startTime: string;
  endTime: string;
  allow: boolean;
}

/**
 * Add/remove list of per-date open/close overrides, replaces the old
 * "only on specific dates" whitelist. Each row picks a date, an optional
 * start/end time window, and whether it forces that date/window open
 * ("Allow") or closed ("Close"), on top of whatever the day-of-week
 * checkboxes below already say. Leaving start/end blank applies to the
 * whole day. See BookingType.dateOverrides in schema.prisma and
 * resolveBookingTypeDateWindows in generate-slots.ts for the exact rules,
 * rows compose in the order listed here, so if two rows ever cover the
 * same date/window, the one lower in this list wins.
 */
export function DateOverrideField({ defaultRows }: { defaultRows: DateOverrideRow[] }) {
  const [rows, setRows] = useState<DateOverrideRow[]>(defaultRows);

  function update(i: number, patch: Partial<DateOverrideRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && <p className="text-xs text-zinc-500">No date overrides set. See day-of-week below instead.</p>}
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 p-2">
          <input
            type="date"
            name="dateOverrideDate"
            value={row.date}
            onChange={(e) => update(i, { date: e.target.value })}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            type="time"
            name="dateOverrideStartTime"
            value={row.startTime}
            onChange={(e) => update(i, { startTime: e.target.value })}
            aria-label="Start time (optional, whole day if blank)"
            className="w-28 rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
          <span className="text-xs text-zinc-400">to</span>
          <input
            type="time"
            name="dateOverrideEndTime"
            value={row.endTime}
            onChange={(e) => update(i, { endTime: e.target.value })}
            aria-label="End time (optional, whole day if blank)"
            className="w-28 rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
          <select
            name="dateOverrideMode"
            value={row.allow ? "allow" : "close"}
            onChange={(e) => update(i, { allow: e.target.value === "allow" })}
            className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
          >
            <option value="allow">Allow bookings</option>
            <option value="close">Close bookings</option>
          </select>
          <button
            type="button"
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            className="ml-auto rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { date: "", startTime: "", endTime: "", allow: true }])}
        className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        + Add a date override
      </button>
    </div>
  );
}
