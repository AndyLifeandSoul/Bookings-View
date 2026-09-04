"use client";

import { useState } from "react";

export interface DateOverrideRow {
  dateFrom: string;
  dateTo: string;
  /// "" = no start time set (paired with endTime === "", means "the whole day").
  startTime: string;
  endTime: string;
  /// true = force open ("Can book") for this range/window, false = force
  /// closed, on top of whatever the day-of-week checkboxes below already
  /// say. Maps straight onto BookingTypeDateOverride.allow in schema.prisma.
  allow: boolean;
  note: string;
}

/**
 * Add/remove list of per-date-range open/close overrides, replaces the old
 * "only on specific dates" whitelist. Each row picks a date range, an
 * optional start/end time window, whether it forces that range/window open
 * ("Can book") or closed, and an optional note, on top of whatever the
 * day-of-week checkboxes below already say. Leaving start/end blank
 * applies to the whole day, every day in [dateFrom, dateTo]. Field order
 * matches Andy's spec (also used for the venue-level special
 * dates/blocked periods form): Start date, End date, Can book, Start
 * time, End time, Note. See BookingType.dateOverrides in schema.prisma
 * and resolveBookingTypeDateWindows in generate-slots.ts for the exact
 * composition rules, rows union/subtract in the order listed here, so if
 * two rows ever cover the same date/window, the one lower in this list
 * wins.
 *
 * The "Can book" checkbox is backed by a same-named hidden input per row
 * rather than submitting its own name, because an unchecked checkbox
 * submits nothing at all, which would silently knock this row's entry out
 * of index alignment with the other parallel-array fields (see
 * parseDateOverrides in actions.ts). The hidden input always submits
 * exactly one "on"/"off" value per row, kept in sync with the checkbox via
 * React state, so getAll() always returns exactly one entry per row.
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
            name="dateOverrideDateFrom"
            value={row.dateFrom}
            onChange={(e) => update(i, { dateFrom: e.target.value })}
            required
            aria-label="Start date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-zinc-400">to</span>
          <input
            type="date"
            name="dateOverrideDateTo"
            value={row.dateTo}
            onChange={(e) => update(i, { dateTo: e.target.value })}
            required
            aria-label="End date"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm text-zinc-700">
            <input type="hidden" name="dateOverrideCanBook" value={row.allow ? "on" : "off"} />
            <input
              type="checkbox"
              checked={row.allow}
              onChange={(e) => update(i, { allow: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Can book
          </label>
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
          <input
            type="text"
            name="dateOverrideNote"
            value={row.note}
            onChange={(e) => update(i, { note: e.target.value })}
            placeholder="Note (optional)"
            className="min-w-32 flex-1 rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
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
        onClick={() => setRows((prev) => [...prev, { dateFrom: "", dateTo: "", startTime: "", endTime: "", allow: true, note: "" }])}
        className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        + Add a date override
      </button>
    </div>
  );
}
