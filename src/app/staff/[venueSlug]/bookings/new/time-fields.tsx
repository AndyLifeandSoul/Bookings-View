import { TimeSelect } from "@/components/time-select";

export interface BookingTypeOption {
  id: string;
  name: string;
  minDurationMinutes: number;
}

/**
 * Booking type, start time and end time for the "Add booking" form.
 * Controlled from the parent (new-booking-form.tsx), which also needs these
 * values for the live table lookup. End time follows the booking type's
 * shortest stay whenever the type or start time changes; a manual change to
 * it sticks until then. Times are dropdowns (TimeSelect), not the native
 * time input, which Safari leaves half-filled and then rejects.
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
          required
          value={bookingTypeId}
          onChange={(e) => onBookingTypeChange(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          {bookingTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Arrives</span>
        <TimeSelect value={startTime} onChange={onStartTimeChange} label="Arrival time" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Leaves</span>
        <TimeSelect value={endTime} onChange={onEndTimeChange} label="Leaving time" />
      </div>
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
