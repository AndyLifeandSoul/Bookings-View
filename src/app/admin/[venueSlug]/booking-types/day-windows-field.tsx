"use client";

import { useState } from "react";
import { TimeSelect } from "@/components/time-select";
import { DAY_LONG, DAY_ORDER } from "./booking-type-summary";

type Window = { earliest: string; latest: string };

/**
 * One row per day, Monday first: tick the day, then optionally set the
 * first and last arrival time for it. Submits exactly what the actions
 * already read: `availableDaysOfWeek` (one value per ticked day) and
 * `dayWindow_<dow>_earliest` / `_latest` as single "HH:mm" values.
 *
 * Times on an unticked day are kept in state but disabled, so they don't
 * submit (a window on a day that isn't bookable never applies) and come
 * back if the day is ticked again.
 */
export function DayWindowsField({
  selectedDays,
  dayWindows,
}: {
  selectedDays: number[];
  dayWindows: { dayOfWeek: number; earliestBookingTime: string; latestBookingTime: string }[];
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(selectedDays));
  const [windows, setWindows] = useState<Record<number, Window>>(() => {
    const out: Record<number, Window> = {};
    for (let d = 0; d <= 6; d++) out[d] = { earliest: "", latest: "" };
    for (const w of dayWindows) out[w.dayOfWeek] = { earliest: w.earliestBookingTime, latest: w.latestBookingTime };
    return out;
  });

  function toggle(day: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(day);
      else next.delete(day);
      return next;
    });
  }

  function setTime(day: number, patch: Partial<Window>) {
    setWindows((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  function copyToAll(from: number) {
    setWindows((prev) => {
      const next = { ...prev };
      for (const d of selected) next[d] = { ...prev[from] };
      return next;
    });
  }

  const firstWithTimes = DAY_ORDER.find((d) => selected.has(d) && (windows[d].earliest || windows[d].latest));
  const quick = "rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={quick} onClick={() => setSelected(new Set([0, 1, 2, 3, 4, 5, 6]))}>
          Every day
        </button>
        <button type="button" className={quick} onClick={() => setSelected(new Set([1, 2, 3, 4, 5]))}>
          Weekdays
        </button>
        <button type="button" className={quick} onClick={() => setSelected(new Set([5, 6, 0]))}>
          Fri to Sun
        </button>
        <button type="button" className={quick} onClick={() => setSelected(new Set())}>
          Clear
        </button>
        {firstWithTimes !== undefined && selected.size > 1 && (
          <button type="button" className={`${quick} ml-auto`} onClick={() => copyToAll(firstWithTimes)}>
            Use {DAY_LONG[firstWithTimes]}&apos;s times on every ticked day
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="hidden grid-cols-[8rem_1fr_1fr] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500 sm:grid">
          <span>Day</span>
          <span>First arrival</span>
          <span>Last arrival</span>
        </div>
        {DAY_ORDER.map((d) => {
          const on = selected.has(d);
          const w = windows[d];
          const overnight = on && w.earliest && w.latest && w.latest < w.earliest;
          return (
            <div
              key={d}
              className={`grid grid-cols-1 items-center gap-2 border-b border-zinc-100 px-3 py-2 last:border-b-0 sm:grid-cols-[8rem_1fr_1fr] sm:gap-3 ${on ? "" : "bg-zinc-50/60"}`}
            >
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                <input
                  type="checkbox"
                  name="availableDaysOfWeek"
                  value={d}
                  checked={on}
                  onChange={(e) => toggle(d, e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className={on ? "" : "text-zinc-400"}>{DAY_LONG[d]}</span>
              </label>
              <span className="flex items-center gap-2">
                <span className="w-20 text-xs text-zinc-500 sm:hidden">First arrival</span>
                <TimeSelect
                  name={`dayWindow_${d}_earliest`}
                  value={w.earliest}
                  onChange={(v) => setTime(d, { earliest: v })}
                  disabled={!on}
                  label={`${DAY_LONG[d]} first arrival`}
                />
              </span>
              <span className="flex items-center gap-2">
                <span className="w-20 text-xs text-zinc-500 sm:hidden">Last arrival</span>
                <TimeSelect
                  name={`dayWindow_${d}_latest`}
                  value={w.latest}
                  onChange={(v) => setTime(d, { latest: v })}
                  disabled={!on}
                  label={`${DAY_LONG[d]} last arrival`}
                />
                {overnight && <span className="text-xs text-zinc-500">next day</span>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">
        Leave the times blank to take bookings across that day&apos;s opening hours. Set them when this type only runs
        part of the day, for example brunch arrivals 12:00 to 14:30. A last arrival earlier than the first means it
        runs past midnight.
      </p>
    </div>
  );
}
