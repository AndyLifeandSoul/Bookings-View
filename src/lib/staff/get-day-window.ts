import { prisma } from "@/lib/db/client";
import { toMinutes } from "@/lib/bookings/time";

export interface DayWindow {
  closed: boolean;
  /** Minutes since midnight. endMinutes can exceed 1440 for an overnight day, see toMinutes' doc comment. */
  startMinutes: number;
  endMinutes: number;
}

const DEFAULT_WINDOW: DayWindow = { closed: false, startMinutes: toMinutes("12:00"), endMinutes: toMinutes("23:00") };

/**
 * The time span the staff diary's grid should cover for one date, a
 * special/altered-hours override if one applies, otherwise the weekly
 * hours for that day-of-week, otherwise a fallback default (never truly
 * "nothing to show", a table view of a closed day with a stray booking on
 * it is still more useful than a blank page). Doesn't account for a
 * partial block (a canBook=false OpeningHoursOverride row with times, see
 * that model's doc comment in schema.prisma), those still leave the
 * surrounding hours open, so they don't change the outer bounds the way a
 * full closure or altered hours would.
 */
export async function getDayWindow(venueId: string, date: Date): Promise<DayWindow> {
  const overrides = await prisma.openingHoursOverride.findMany({
    where: { venueId, dateFrom: { lte: date }, dateTo: { gte: date } },
  });

  const closedWholeDay = overrides.some((o) => !o.canBook && !o.startTime && !o.endTime);
  if (closedWholeDay) return { closed: true, startMinutes: 0, endMinutes: 0 };

  const openOverrides = overrides.filter(
    (o): o is typeof o & { startTime: string; endTime: string } => o.canBook && o.startTime != null && o.endTime != null,
  );
  if (openOverrides.length > 0) {
    const windows = openOverrides.map((o) => toWindow(o.startTime, o.endTime));
    return {
      closed: false,
      startMinutes: Math.min(...windows.map((w) => w.startMinutes)),
      endMinutes: Math.max(...windows.map((w) => w.endMinutes)),
    };
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
