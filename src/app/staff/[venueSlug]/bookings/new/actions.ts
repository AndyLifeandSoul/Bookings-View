"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { findTableConflicts } from "@/lib/staff/table-conflicts";
import { formatBookingRef } from "@/lib/bookings/booking-reference";
import type { ActionResult } from "@/components/action-form";

/** Same "trust nothing but the session" shape as the booking-details actions — see that file's requireVenueAccess doc comment. */
async function requireVenueAccess(venueId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Not signed in." };
  if (session.role === "STAFF" && session.venueId !== venueId) {
    return { error: "That venue isn't yours." };
  }
  return { ok: true };
}

function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Manual "Add booking" — a phoned-in or walk-in booking staff enter
 * directly, skipping the customer widget's availability/deposit flow
 * entirely (this always creates a CONFIRMED booking with a table already
 * picked, not something needing payment or slot validation). Per Andy's
 * rules: a same-day booking only needs a time, name, table and booking
 * type — no contact details required (someone booking a table for tonight
 * over the phone doesn't need to give an email). A future-dated booking
 * needs a name and at least one of email/phone, plus who took it, since
 * there's no other record of that conversation.
 */
export async function createManualBooking(formData: FormData): Promise<ActionResult> {
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, bookingCode: true } });
  if (!venue) return { error: "Unknown venue." };

  const dateStr = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "A valid date is required." };
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const isSameDay = date.getTime() === todayUtcDateOnly().getTime();

  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(startTime) || !/^\d{1,2}:\d{2}$/.test(endTime)) {
    return { error: "Start and end time are required." };
  }

  const bookingTypeId = String(formData.get("bookingTypeId") ?? "");
  const bookingType = await prisma.bookingType.findFirst({ where: { id: bookingTypeId, venueId } });
  if (!bookingType) return { error: "Pick a booking type." };

  const customerName = String(formData.get("customerName") ?? "").trim();
  if (!customerName) return { error: "Customer name is required." };
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const takenByStaffName = String(formData.get("takenByStaffName") ?? "").trim() || null;

  const partySizeRaw = Number(formData.get("partySize"));
  if (!Number.isFinite(partySizeRaw) || partySizeRaw < 1) return { error: "Party size must be at least 1." };
  const partySize = Math.trunc(partySizeRaw);

  const tableIds = formData.getAll("tableIds").map(String).filter(Boolean);

  if (isSameDay) {
    if (tableIds.length === 0) return { error: "A same-day booking needs at least one table." };
  } else {
    if (!customerEmail && !customerPhone) {
      return { error: "A future-dated booking needs an email or phone number for the customer." };
    }
    if (!takenByStaffName) return { error: "Enter who took this booking." };
  }
  if (customerEmail && !customerEmail.includes("@")) return { error: "Email doesn't look valid." };

  if (tableIds.length > 0) {
    const validTables = await prisma.table.count({ where: { id: { in: tableIds }, venueId } });
    if (validTables !== tableIds.length) return { error: "One or more selected tables don't belong to this venue." };

    const conflicts = await findTableConflicts({ venueId, date, startTime, endTime, tableIds });
    if (conflicts.length > 0) {
      const names = [...new Set(conflicts.map((c) => `${c.tableLabel} (${c.customerName}, ${c.startTime}-${c.endTime})`))];
      return { error: `Can't book — already booked at this time: ${names.join(", ")}.` };
    }
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
        partySize,
        status: "CONFIRMED",
        source: "PHONE",
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        takenByStaffName,
        bookingTables: tableIds.length > 0 ? { create: tableIds.map((tableId) => ({ tableId })) } : undefined,
      },
    });
  });

  redirect(`/staff/${venueSlug}/bookings/${booking.id}`);
}
