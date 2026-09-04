export interface BookingTypeOption {
  id: string;
  name: string;
  minDurationMinutes: number;
}

/**
 * Booking type / start time / end time fields for the "Add booking" form.
 * Fully controlled from the parent (new-booking-form.tsx) rather than
 * holding its own state, because the parent also needs the current
 * bookingTypeId/startTime/endTime to drive the live table-availability
 * lookup and to build the submission itself - a single source of truth
 * for these three fields, not one copy here and another in the parent.
 *
 * The "end time auto-follows the selected booking type's minimum duration"
 * behaviour (Andy: "if I select Standard Dining, it should automatically
 * change the end time to the minimum duration for that booking type
 * compared to the start time") lives in the parent's change handlers,
 * using computeEndTime below. Nothing stops a manual edit to End time
 * sticking until the next booking-type/start-time change recomputes it.
 */
export function TimeFields({
  bookingTypes,
  bookingTypeId,
  onBookingTypeChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
}: {
  bookingTypes: BookingTypeOption[];
  bookingTypeId: string;
  onBookingTypeChange: (id: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  endTime: string;
  onEndTimeChange: (value: string) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Booking type</span>
        <select
          name="bookingTypeId"
          required
          value={bookingTypeId}
          onChange={(e) => onBookingTypeChange(e.target.value)}
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
          onChange={(e) => onStartTimeChange(e.target.value)}
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
          onChange={(e) => onEndTimeChange(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
    </>
  );
}

export function computeEndTime(startTime: string, durationMinutes: number | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime);
  if (!match || durationMinutes == null) return startTime;
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = (startMinutes + durationMinutes) % (24 * 60);
  const h = Math.floor(endMinutes / 60);
  const m = endMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
