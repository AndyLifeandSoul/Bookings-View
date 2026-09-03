"use client";

import { useState } from "react";

/**
 * Add/remove list of specific dates a booking type is available on — the
 * "one-off specials" override (a quiz night run on three picked evenings)
 * that takes priority over the day-of-week checkboxes when non-empty. See
 * BookingType.availableDates in schema.prisma. Plain HTML checkboxes handle
 * the day-of-week case with no JS needed; this needs client state only
 * because the list of rows itself grows/shrinks.
 */
export function AvailableDatesField({ defaultDates }: { defaultDates: string[] }) {
  const [dates, setDates] = useState<string[]>(defaultDates.length > 0 ? defaultDates : []);

  return (
    <div className="flex flex-col gap-2">
      {dates.length === 0 && <p className="text-xs text-zinc-500">No specific dates set — see day-of-week below instead.</p>}
      {dates.map((date, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="date"
            name="availableDates"
            value={date}
            onChange={(e) => setDates((prev) => prev.map((d, j) => (j === i ? e.target.value : d)))}
            required
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
          <button
            type="button"
            onClick={() => setDates((prev) => prev.filter((_, j) => j !== i))}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setDates((prev) => [...prev, ""])}
        className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        + Add a date
      </button>
    </div>
  );
}
