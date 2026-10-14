"use client";

import { useState } from "react";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

/**
 * Per-day booking windows + Available days, kept together as one client
 * component so the two stay in sync: a day that is not ticked in Available
 * days is greyed out in the window table and its time inputs are disabled.
 * Disabled inputs do not submit, which is correct because a window on a day
 * the booking type is not available never applies. Re-ticking a day restores
 * the times already typed (the inputs are uncontrolled, so their values
 * survive the disable).
 */
export function DayWindowsField({
  selectedDays,
  dayWindows,
}: {
  selectedDays: number[];
  dayWindows: { dayOfWeek: number; earliestBookingTime: string; latestBookingTime: string }[];
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(selectedDays));
  const dayWindowByDow = new Map(dayWindows.map((w) => [w.dayOfWeek, w]));

  function toggle(value: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(value);
      } else {
        next.delete(value);
      }
      return next;
    });
  }

  return (
    <>
      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Per-day booking windows</legend>
        <p className="text-xs text-zinc-500">
          Optional. Set a start-time window for individual days when they differ (e.g. brunch runs a different time on
          Saturday than Sunday). A day left blank uses the venue&apos;s opening hours for that day. A window can cross midnight (e.g. 18:00 to 02:00). Days not ticked in &quot;Available days&quot; below are greyed out here and their windows are ignored.
        </p>
        <div className="flex flex-col gap-2">
          {DAYS_OF_WEEK.map((d) => {
            const w = dayWindowByDow.get(d.value);
            const on = selected.has(d.value);
            return (
              <div
                key={d.value}
                className={`grid grid-cols-[3rem_1fr_1fr] items-center gap-2 ${on ? "" : "opacity-60"}`}
              >
                <span className={`text-sm ${on ? "text-zinc-600" : "text-zinc-400"}`}>{d.label}</span>
                <input
                  type="time"
                  name={`dayWindow_${d.value}_earliest`}
                  defaultValue={w?.earliestBookingTime ?? ""}
                  aria-label={`${d.label} earliest`}
                  disabled={!on}
                  className={`rounded-md border px-2 py-1.5 text-sm ${on ? "border-zinc-300" : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"}`}
                />
                <input
                  type="time"
                  name={`dayWindow_${d.value}_latest`}
                  defaultValue={w?.latestBookingTime ?? ""}
                  aria-label={`${d.label} latest`}
                  disabled={!on}
                  className={`rounded-md border px-2 py-1.5 text-sm ${on ? "border-zinc-300" : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"}`}
                />
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Available days</legend>
        <div className="flex flex-wrap gap-3">
          {DAYS_OF_WEEK.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                name="availableDaysOfWeek"
                value={d.value}
                checked={selected.has(d.value)}
                onChange={(e) => toggle(d.value, e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
