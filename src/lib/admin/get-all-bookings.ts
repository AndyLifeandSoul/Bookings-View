import { prisma } from "@/lib/db/client";

export interface AllBookingsFilters {
  venueId?: string;
  /** Booking type NAME (not slug/id) — see this function's doc comment for why. */
  bookingTypeName?: string;
  /** Bookings on or after this date (inclusive). */
  dateFrom?: Date;
  /** Bookings on or before this date (inclusive). */
  dateTo?: Date;
}

export interface AllBookingsRow {
  id: string;
  venueSlug: string;
  venueName: string;
  customerName: string;
  partySize: number;
  date: Date;
  startTime: string;
  endTime: string;
  bookingTypeName: string;
}

/**
 * Every CONFIRMED booking across every venue — the cross-venue All Bookings
 * admin tab's data source. CONFIRMED only, per Andy's spec ("all confirmed
 * bookings"): ENQUIRY has its own dedicated tab (get-open-enquiries.ts),
 * and CANCELLED/NO_SHOW/COMPLETED/PENDING_PAYMENT aren't "a booking that's
 * happening" in the sense this page is for.
 *
 * bookingTypeName filters by name, not a specific venue's booking type id —
 * different venues have their own BookingType rows (even same-named ones,
 * e.g. every venue's own "Food Reservations"), and a cross-venue filter
 * needs to match all of them at once. Same convention getDashboardStats'
 * coversByType already uses to merge same-named types across venues.
 */
export async function getAllBookings(filters: AllBookingsFilters): Promise<AllBookingsRow[]> {
  const rows = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      venueId: filters.venueId,
      bookingType: filters.bookingTypeName ? { name: filters.bookingTypeName } : undefined,
      ...(filters.dateFrom || filters.dateTo ? { date: { gte: filters.dateFrom, lte: filters.dateTo } } : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      customerName: true,
      partySize: true,
      date: true,
      startTime: true,
      endTime: true,
      venue: { select: { slug: true, name: true } },
      bookingType: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    venueSlug: r.venue.slug,
    venueName: r.venue.name,
    customerName: r.customerName,
    partySize: r.partySize,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    bookingTypeName: r.bookingType.name,
  }));
}

/** Every distinct active booking-type name across every venue, alphabetical — for the filter dropdown. */
export async function listBookingTypeNames(): Promise<string[]> {
  const rows = await prisma.bookingType.findMany({
    where: { active: true },
    distinct: ["name"],
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => r.name);
}
