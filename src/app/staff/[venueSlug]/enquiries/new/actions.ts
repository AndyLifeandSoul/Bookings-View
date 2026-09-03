"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { formatBookingRef } from "@/lib/bookings/booking-reference";
import type { ActionResult } from "@/components/action-form";

async function requireVenueAccess(venueId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Not signed in." };
  if (session.role === "STAFF" && session.venueId !== venueId) {
    return { error: "That venue isn't yours." };
  }
  return { ok: true };
}

/**
 * Manual "Add enquiry" — a phoned-in or in-person enquiry staff log
 * directly. Unlike Add booking, every field here is required (per Andy's
 * spec): name, email, phone, booking type, date, time, who took it, and a
 * note of what was discussed — there's no "lighter" same-day version of an
 * enquiry the way there is for a confirmed booking, since an enquiry by
 * definition still needs staff to follow up. No table — enquiries skip
 * table assignment until staff convert one to a confirmed booking, same as
 * every other enquiry in the system (see create-booking.ts's isEnquiry
 * branch in the canonical repo).
 */
export async function createManualEnquiry(formData: FormData): Promise<ActionResult> {
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, bookingCode: true } });
  if (!venue) return { error: "Unknown venue." };

  const dateStr = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "A valid date is required." };
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const startTime = String(formData.get("startTime") ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(startTime)) return { error: "A valid time is required." };

  const bookingTypeId = String(formData.get("bookingTypeId") ?? "");
  const bookingType = await prisma.bookingType.findFirst({ where: { id: bookingTypeId, venueId } });
  if (!bookingType) return { error: "Pick a booking type." };

  const customerName = String(formData.get("customerName") ?? "").trim();
  if (!customerName) return { error: "Name is required." };
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  if (!customerEmail || !customerEmail.includes("@")) return { error: "A valid email is required." };
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  if (!customerPhone) return { error: "Phone is required." };
  const takenByStaffName = String(formData.get("takenByStaffName") ?? "").trim();
  if (!takenByStaffName) return { error: "Enter who took this enquiry." };
  const notes = String(formData.get("notes") ?? "").trim();
  if (!notes) return { error: "Add a note of what was discussed." };

  const partySizeRaw = Number(formData.get("partySize"));
  if (!Number.isFinite(partySizeRaw) || partySizeRaw < 1) return { error: "Party size must be at least 1." };
  const partySize = Math.trunc(partySizeRaw);

  // An enquiry's end time isn't something the customer/staff negotiate up
  // front the way a confirmed booking's is — default to the booking type's
  // minimum duration, same starting assumption generateAvailableSlots uses
  // before a duration is actually chosen; it's revisable from the booking
  // details page once this is confirmed.
  const [sh, sm] = startTime.split(":").map(Number);
  const endMinutes = sh * 60 + sm + bookingType.minDurationMinutes;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

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
        status: "ENQUIRY",
        source: "PHONE",
        customerName,
        customerEmail,
        customerPhone,
        notes,
        takenByStaffName,
      },
    });
  });

  redirect(`/staff/${venueSlug}/bookings/${booking.id}`);
}
