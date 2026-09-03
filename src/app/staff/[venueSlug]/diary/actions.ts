"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { findTableConflicts } from "@/lib/staff/table-conflicts";
import { getDayWindow } from "@/lib/staff/get-day-window";
import { toMinutes, formatMinutes } from "@/lib/bookings/time";
import { formatBookingRef } from "@/lib/bookings/booking-reference";

export interface MoveResult {
  ok: boolean;
  error?: string;
}

/**
 * Drag-drop reassignment: moves one booking's seat from one table to
 * another, leaving any other tables already assigned to the same booking
 * (a combined-table booking) untouched — dragging a booking card off Table
 * 3's row and onto Booth 1's row means "reseat this part of the booking",
 * not "collapse the whole booking onto one table". Called directly from
 * client-side drop handlers (not a <form> action, since there's no form
 * here — see diary-grid.tsx), so it returns a plain result object instead
 * of the ActionResult shape the rest of the app's Server Actions use.
 */
export async function moveBookingTable(params: {
  bookingId: string;
  /** Null when dragging a currently-unassigned booking onto a table for the first time — this then just adds a BookingTable row rather than moving one. */
  fromTableId: string | null;
  toTableId: string;
  venueId: string;
  venueSlug: string;
}): Promise<MoveResult> {
  const { bookingId, fromTableId, toTableId, venueId, venueSlug } = params;
  if (fromTableId === toTableId) return { ok: true };

  const session = await getCurrentStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (session.role === "STAFF" && session.venueId !== venueId) {
    return { ok: false, error: "That booking doesn't belong to your venue." };
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, venueId },
    select: { date: true, startTime: true, endTime: true },
  });
  if (!booking) return { ok: false, error: "Booking not found for this venue." };

  const toTable = await prisma.table.findFirst({ where: { id: toTableId, venueId }, select: { id: true } });
  if (!toTable) return { ok: false, error: "Target table doesn't belong to this venue." };

  const conflicts = await findTableConflicts({
    venueId,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    tableIds: [toTableId],
    excludeBookingId: bookingId,
  });
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return { ok: false, error: `${c.tableLabel} is already booked ${c.startTime}-${c.endTime} (${c.customerName}).` };
  }

  await prisma.$transaction([
    ...(fromTableId ? [prisma.bookingTable.deleteMany({ where: { bookingId, tableId: fromTableId } })] : []),
    prisma.bookingTable.create({ data: { bookingId, tableId: toTableId } }),
  ]);

  revalidatePath(`/staff/${venueSlug}/diary`);
  return { ok: true };
}

export interface WalkInResult {
  ok: boolean;
  error?: string;
  bookingId?: string;
}

/**
 * "Add walk-in" from the diary — a table blocker for someone who's arrived
 * without a booking, not a real customer record. Per Andy's spec: staff pick
 * only a table and a booking type; everything else is filled in
 * automatically — customerName "Walk in", partySize 1 (nothing about a
 * walk-in's actual headcount feeds any capacity logic, same as the manual
 * "Add booking" flow), startTime "now", status CONFIRMED, source PHONE,
 * isWalkIn true (see that field's doc comment for why it's excluded from
 * Customers/marketing). checkedInAt is set immediately since a walk-in is
 * by definition already at the table.
 *
 * endTime defaults to the venue's closing time for the day (or 2 hours out
 * if the day has no normal hours, e.g. a booking made on an otherwise-closed
 * day) — a walk-in's actual length of stay isn't known up front, so this
 * just needs to be "long enough to block the table until someone checks
 * them out", not an accurate estimate. Checking the booking out (booking
 * details page) frees the table immediately regardless of this endTime —
 * see Booking.checkedOutAt.
 *
 * startTime comes from the *client's* clock rather than the server's — this
 * app stores every time as a plain "HH:mm" venue-local string with no
 * timezone conversion anywhere (see Venue.timezone's doc comment), and
 * unlike a booking's date, there's no existing server-side "what time is it
 * right now, venue-local" helper to reuse. Staff adding a walk-in are
 * physically at the venue, so their browser's clock already reads
 * venue-local time — trusting it here avoids a server-timezone (UTC vs.
 * BST) bug for a value that only ever labels a table-blocker's start time.
 */
export async function createWalkIn(params: {
  venueId: string;
  venueSlug: string;
  /** "YYYY-MM-DD", the diary date this walk-in is being added from. */
  date: string;
  tableId: string;
  bookingTypeId: string;
  /** "HH:mm", the client's current local time — see this function's doc comment. */
  startTime: string;
}): Promise<WalkInResult> {
  const { venueId, venueSlug, date: dateStr, tableId, bookingTypeId, startTime } = params;

  const session = await getCurrentStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (session.role === "STAFF" && session.venueId !== venueId) {
    return { ok: false, error: "That venue isn't yours." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, error: "Invalid date." };
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (!/^\d{1,2}:\d{2}$/.test(startTime)) return { ok: false, error: "Invalid start time." };

  const [venue, bookingType, table] = await Promise.all([
    prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, bookingCode: true } }),
    prisma.bookingType.findFirst({ where: { id: bookingTypeId, venueId }, select: { id: true } }),
    prisma.table.findFirst({ where: { id: tableId, venueId }, select: { id: true } }),
  ]);
  if (!venue) return { ok: false, error: "Unknown venue." };
  if (!bookingType) return { ok: false, error: "Pick a booking type." };
  if (!table) return { ok: false, error: "Pick a table." };

  const window = await getDayWindow(venueId, date);
  const startMinutes = toMinutes(startTime);
  const endMinutes = !window.closed && window.endMinutes > startMinutes ? window.endMinutes : startMinutes + 120;
  const endTime = formatMinutes(endMinutes);

  const conflicts = await findTableConflicts({ venueId, date, startTime, endTime, tableIds: [tableId] });
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return { ok: false, error: `${c.tableLabel} is already booked ${c.startTime}-${c.endTime} (${c.customerName}).` };
  }

  const booking = await prisma.$transaction(async (tx) => {
    let bookingRef: string | null = null;
    if (venue.bookingCode) {
      const updated = await tx.venue.update({
        where: { id: venue.id },
        data: { bookingRefCounter: { increment: 1 } },
        select: { bookingRefCounter: true },
      });
      bookingRef = formatBookingRef(venue.bookingCode, date, updated.bookingRefCounter);
    }

    return tx.booking.create({
      data: {
        venueId,
        bookingTypeId,
        bookingRef,
        date,
        startTime,
        endTime,
        partySize: 1,
        status: "CONFIRMED",
        source: "PHONE",
        customerName: "Walk in",
        isWalkIn: true,
        checkedInAt: new Date(),
        bookingTables: { create: [{ tableId }] },
      },
    });
  });

  revalidatePath(`/staff/${venueSlug}/diary`);
  return { ok: true, bookingId: booking.id };
}
