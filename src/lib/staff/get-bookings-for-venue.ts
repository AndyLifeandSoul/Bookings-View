import { prisma } from "@/lib/db/client";

/**
 * Upcoming bookings for one venue, for the staff dashboard. Deliberately
 * scoped to a single venueId (never accepts a list) — the caller is always
 * one staff session tied to one venue, and this being narrow is what makes
 * "staff only ever see their own venue's diary" a property of the query,
 * not just something the UI happens to do.
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
      notes: true,
      bookingType: { select: { name: true } },
    },
  });
}
