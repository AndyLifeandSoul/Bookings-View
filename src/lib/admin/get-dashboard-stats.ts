import { prisma } from "@/lib/db/client";

export interface CoversByType {
  bookingTypeName: string;
  bookings: number;
  covers: number;
}

export interface CoversByVenue {
  venueName: string;
  bookings: number;
  covers: number;
}

export interface DashboardStats {
  bookingsToday: number;
  coversToday: number;
  bookingsThisWeek: number;
  coversThisWeek: number;
  weekLabel: string;
  /** Grouped by booking type NAME across every venue (e.g. two venues' "Standard Dining" merge into one row), a cross-estate "how much of X are we doing" view, not broken out per venue. */
  coversByType: CoversByType[];
  /** The same week's bookings, grouped by venue instead of booking type, so multi-venue load is visible at a glance from Home. */
  coversByVenue: CoversByVenue[];
}

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday of the ISO week containing `d`. */
function startOfIsoWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // days to subtract to reach Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return utcDateOnly(monday);
}

/**
 * Cross-venue stats for the admin Home dashboard. "Today"/"this week" are
 * plain UTC calendar dates, same convention as the rest of the app (Booking
 * .date is @db.Date with no per-venue timezone handling elsewhere either —
 * every venue is UK-based anyway). "This week" is the ISO week (Monday to
 * Sunday) containing today, not a rolling 7 days. Non-cancelled bookings
 * only (ENQUIRY included) — consistent with getUpcomingBookingsForVenue's
 * status filter elsewhere in the app.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const today = utcDateOnly(new Date());
  const weekStart = startOfIsoWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7); // exclusive upper bound

  const [todayRows, weekRows] = await Promise.all([
    prisma.booking.findMany({
      where: { date: today, status: { not: "CANCELLED" } },
      select: { partySize: true },
    }),
    prisma.booking.findMany({
      where: { date: { gte: weekStart, lt: weekEnd }, status: { not: "CANCELLED" } },
      select: { partySize: true, bookingType: { select: { name: true } }, venue: { select: { name: true } } },
    }),
  ]);

  const byType = new Map<string, CoversByType>();
  const byVenue = new Map<string, CoversByVenue>();
  for (const row of weekRows) {
    const typeKey = row.bookingType.name;
    const existingType = byType.get(typeKey);
    if (existingType) {
      existingType.bookings += 1;
      existingType.covers += row.partySize;
    } else {
      byType.set(typeKey, { bookingTypeName: typeKey, bookings: 1, covers: row.partySize });
    }

    const venueKey = row.venue.name;
    const existingVenue = byVenue.get(venueKey);
    if (existingVenue) {
      existingVenue.bookings += 1;
      existingVenue.covers += row.partySize;
    } else {
      byVenue.set(venueKey, { venueName: venueKey, bookings: 1, covers: row.partySize });
    }
  }

  const weekEndInclusive = new Date(weekEnd);
  weekEndInclusive.setUTCDate(weekEnd.getUTCDate() - 1);

  return {
    bookingsToday: todayRows.length,
    coversToday: todayRows.reduce((sum, r) => sum + r.partySize, 0),
    bookingsThisWeek: weekRows.length,
    coversThisWeek: weekRows.reduce((sum, r) => sum + r.partySize, 0),
    weekLabel: `${formatShort(weekStart)}–${formatShort(weekEndInclusive)}`,
    coversByType: [...byType.values()].sort((a, b) => b.covers - a.covers),
    coversByVenue: [...byVenue.values()].sort((a, b) => b.covers - a.covers),
  };
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
