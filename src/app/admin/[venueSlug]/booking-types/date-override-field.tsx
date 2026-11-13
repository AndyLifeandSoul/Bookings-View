"use client";

import { useRef, useState } from "react";
import { TimeSelect } from "@/components/time-select";
import { DateSelect } from "@/components/date-select";

export interface DateOverrideRow {
  dateFrom: string;
  dateTo: string;
  /// "" = no start time set (paired with endTime === "", means "the whole day").
  startTime: string;
  endTime: string;
  /// true = force open for this range/window, false = force closed, on top of
  /// the ticked days. Maps straight onto BookingTypeDateOverride.allow.
  allow: boolean;
  note: string;
}

/**
 * Add/remove list of date exceptions: a date range, open or closed, an
 * optional time window (blank = the whole day) and a note. Rows apply in
 * the order listed, so where two cover the same date the lower one wins
 * (see resolveBookingTypeDateWindows in generate-slots.ts).
 *
 * Every row submits exactly one value for each of the parallel fields
 * parseDateOverrides in actions.ts reads with getAll(), so they stay index
 * aligned: dates and times through the hidden inputs in DateSelect and
 * TimeSelect (which submit "" when not set), and open/closed through a
 * hidden `dateOverrideCanBook` "on"/"off".
 */
export function DateOverrideField({ defaultRows }: { defaultRows: DateOverrideRow[] }) {
  const nextKey = useRef(defaultRows.length);
  const [rows, setRows] = useState<(DateOverrideRow & { key: number })[]>(() =>
    defaultRows.map((r, i) => ({ ...r, key: i })),
  );

  function update(key: number, patch: Partial<DateOverrideRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function add() {
    const key = nextKey.current++;
    setRows((prev) => [...prev, { key, dateFrom: "", dateTo: "", startTime: "", endTime: "", allow: false, note: "" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="text-xs text-zinc-500">
          None yet. Use these for one-off changes, like closing this type over Christmas or opening it on a bank
          holiday Monday.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={row.key} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
            <DateSelect
              name="dateOverrideDateFrom"
              defaultValue={row.dateFrom}
              onChange={(v) => update(row.key, { dateFrom: v })}
              label={`Exception ${i + 1} from`}
            />
            <span className="text-xs text-zinc-500">to</span>
            <DateSelect
              name="dateOverrideDateTo"
              defaultValue={row.dateTo}
              onChange={(v) => update(row.key, { dateTo: v })}
              label={`Exception ${i + 1} to`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
            <input type="hidden" name="dateOverrideCanBook" value={row.allow ? "on" : "off"} />
            <select
              aria-label={`Exception ${i + 1} open or closed`}
              value={row.allow ? "open" : "closed"}
              onChange={(e) => update(row.key, { allow: e.target.value === "open" })}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="closed">Closed</option>
              <option value="open">Open</option>
            </select>
            <span className="text-xs text-zinc-500">{row.allow ? "first booking" : "from"}</span>
            <TimeSelect
              name="dateOverrideStartTime"
              value={row.startTime}
              onChange={(v) => update(row.key, { startTime: v })}
              label={`Exception ${i + 1} start time`}
            />
            <span className="text-xs text-zinc-500">{row.allow ? "last booking" : "to"}</span>
            <TimeSelect
              name="dateOverrideEndTime"
              value={row.endTime}
              onChange={(v) => update(row.key, { endTime: v })}
              label={`Exception ${i + 1} end time`}
            />
            <span className="text-xs text-zinc-400">blank = all day</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              name="dateOverrideNote"
              value={row.note}
              onChange={(e) => update(row.key, { note: e.target.value })}
              placeholder="Note for staff (optional)"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        + Add a date
      </button>
    </div>
  );
}
