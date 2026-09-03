"use client";

import { useState } from "react";

export interface BookingTypeOption {
  id: string;
  name: string;
  minDurationMinutes: number;
}

/**
 * Booking type / start time / end time, as one client component so end time
 * can auto-follow the selected booking type's minimum duration — Andy's
 * report: "if I select Standard Dining, it should automatically change the
 * end time to the minimum duration for that booking type compared to the
 * start time." Also what actually fixes the underlying bug he hit: the
 * previous plain `<input type="time">`s had no defaultValue at all, so what
 * looked like a pre-filled "12:30" in the browser's own empty-time-input
 * placeholder was never a real value — submitting empty strings the server
 * then rejected as "not filled in". Real state here means what's displayed
 * always matches what's actually in the form.
 *
 * End time still auto-follows start time/booking type after the user edits
 * it once — re-picking a booking type (the far more common "oops, wrong
 * type" correction) should still snap the duration back to that type's
 * minimum, and a same-day walk-in booking is normally left at the computed
 * minimum anyway. Nothing stops a manual edit sticking until the next
 * change event fires.
 */
export function TimeFields({ bookingTypes }: { bookingTypes: BookingTypeOption[] }) {
  const [bookingTypeId, setBookingTypeId] = useState(bookingTypes[0]?.id ?? "");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState(() => computeEndTime("18:00", bookingTypes[0]?.minDurationMinutes));

  function handleBookingTypeChange(id: string) {
    setBookingTypeId(id);
    const type = bookingTypes.find((t) => t.id === id);
    setEndTime(computeEndTime(startTime, type?.minDurationMinutes));
  }

  function handleStartTimeChange(value: string) {
    setStartTime(value);
    const type = bookingTypes.find((t) => t.id === bookingTypeId);
    setEndTime(computeEndTime(value, type?.minDurationMinutes));
  }

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Booking type</span>
        <select
          name="bookingTypeId"
          required
          value={bookingTypeId}
          onChange={(e) => handleBookingTypeChange(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        >
          {bookingTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Start time</span>
        <input
          type="time"
          name="startTime"
          required
          value={startTime}
          onChange={(e) => handleStartTimeChange(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">End time</span>
        <input
          type="time"
          name="endTime"
          required
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
        <span className="text-xs text-zinc-500">Auto-filled from the booking type&apos;s minimum duration — edit freely.</span>
      </label>
    </>
  );
}

function computeEndTime(startTime: string, durationMinutes: number | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime);
  if (!match || durationMinutes == null) return startTime;
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = (startMinutes + durationMinutes) % (24 * 60);
  const h = Math.floor(endMinutes / 60);
  const m = endMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
