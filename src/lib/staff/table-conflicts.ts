import { prisma } from "@/lib/db/client";
import { toMinutes, rangesOverlap } from "@/lib/bookings/time";

export interface TableConflict {
  tableId: string;
  tableLabel: string;
  bookingId: string;
  customerName: string;
  startTime: string;
  endTime: string;
}

/**
 * Which of the given tables, on the given date/time range, are already
 * seating a *different* active booking that overlaps. Used both by the
 * booking-details reassignment form and the staff diary's drag-drop —
 * anywhere a booking is being pinned to one or more tables outside the
 * auto-assignment algorithm (lifeandsoul-bookings' assignTables), so this
 * is deliberately a much simpler pairwise overlap check, not a re-run of
 * that algorithm. CANCELLED bookings never conflict; a booking never
 * conflicts with itself (excludeBookingId); a booking that's been checked
 * out never conflicts either — its table is cleared and bookable again
 * regardless of how much of its formal window remains (Booking.checkedOutAt).
 */
export async function findTableConflicts(params: {
  venueId: string;
  date: Date;
  startTime: string;
  endTime: string;
  tableIds: string[];
  excludeBookingId?: string;
}): Promise<TableConflict[]> {
  const { venueId, date, startTime, endTime, tableIds, excludeBookingId } = params;
  if (tableIds.length === 0) return [];

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  const rows = await prisma.bookingTable.findMany({
    where: {
      tableId: { in: tableIds },
      table: { venueId },
      booking: {
        date,
        status: { not: "CANCELLED" },
        checkedOutAt: null,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    },
    select: {
      tableId: true,
      table: { select: { label: true } },
      booking: { select: { id: true, customerName: true, startTime: true, endTime: true } },
    },
  });

  const conflicts: TableConflict[] = [];
  for (const row of rows) {
    if (rangesOverlap(start, end, toMinutes(row.booking.startTime), toMinutes(row.booking.endTime))) {
      conflicts.push({
        tableId: row.tableId,
        tableLabel: row.table.label,
        bookingId: row.booking.id,
        customerName: row.booking.customerName,
        startTime: row.booking.startTime,
        endTime: row.booking.endTime,
      });
    }
  }
  return conflicts;
}
