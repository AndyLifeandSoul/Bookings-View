"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { findTableConflicts } from "@/lib/staff/table-conflicts";

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
