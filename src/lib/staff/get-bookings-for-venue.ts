import { prisma } from "@/lib/db/client";

/**
 * Upcoming bookings for one venue, for the staff dashboard. Deliberately
 * scoped to a single venueId (never accepts a list) - a STAFF session is
 * always tied to exactly one venue and requireStaffVenue() enforces that at
 * the page level, so this staying narrow is what makes "staff only ever see
 * their own venue's diary" a property of the query, not just something the
 * UI happens to do. An OWNER/MANAGER session calls this once per venue it
 * chooses to look at via the venue switcher, same query either way.
 */
export async function getUpcomingBookingsForVenue(venueId: string) {
  const today = new Date();
  const todayDateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  return prisma.booking.findMany({
    where: {
      venueId,
      date: { gte: todayDateOnly },
      status: { not: "CANCELLED" },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 200,
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      partySize: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      bookingRef: true,
      notes: true,
      bookingType: { select: { name: true } },
    },
  });
}
