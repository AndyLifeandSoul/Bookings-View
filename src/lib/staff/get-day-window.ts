import { prisma } from "@/lib/db/client";
import { toMinutes } from "@/lib/bookings/time";

export interface DayWindow {
  closed: boolean;
  /** Minutes since midnight. endMinutes can exceed 1440 for an overnight day — see toMinutes' doc comment. */
  startMinutes: number;
  endMinutes: number;
}

const DEFAULT_WINDOW: DayWindow = { closed: false, startMinutes: toMinutes("12:00"), endMinutes: toMinutes("23:00") };

/**
 * The time span the staff diary's grid should cover for one date — special
 * date override if one exists, otherwise the weekly hours for that
 * day-of-week, otherwise a fallback default (never truly "nothing to show"
 * — a table view of a closed day with a stray booking on it is still more
 * useful than a blank page). Doesn't account for OpeningHoursBlock
 * carve-outs; those still leave the surrounding hours open, so they don't
 * change the outer bounds the way a full closure or special hours would.
 */
export async function getDayWindow(venueId: string, date: Date): Promise<DayWindow> {
  const exception = await prisma.openingHoursException.findUnique({
    where: { venueId_date: { venueId, date } },
  });

  if (exception) {
    if (exception.isClosed) return { closed: true, startMinutes: 0, endMinutes: 0 };
    if (exception.opensAt && exception.closesAt) {
      return toWindow(exception.opensAt, exception.closesAt);
    }
  }

  const dayOfWeek = date.getUTCDay();
  const weekly = await prisma.openingHours.findUnique({
    where: { venueId_dayOfWeek: { venueId, dayOfWeek } },
  });
  if (!weekly) return { closed: true, startMinutes: 0, endMinutes: 0 };

  return toWindow(weekly.opensAt, weekly.closesAt);
}

function toWindow(opensAt: string, closesAt: string): DayWindow {
  const start = toMinutes(opensAt);
  let end = toMinutes(closesAt);
  if (end <= start) end += 24 * 60; // past-midnight closing, same convention as lifeandsoul-bookings' engine
  return { closed: false, startMinutes: start, endMinutes: end };
}

export function fallbackWindow(): DayWindow {
  return DEFAULT_WINDOW;
}
