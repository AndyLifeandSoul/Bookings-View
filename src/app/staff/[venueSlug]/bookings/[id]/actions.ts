"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { findTableConflicts } from "@/lib/staff/table-conflicts";
import type { ActionResult } from "@/components/action-form";
import type { BookingStatus } from "@/generated/prisma";

const STATUSES: BookingStatus[] = ["ENQUIRY", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"];

/**
 * Same "trust nothing but the session" shape as requireAdminSession, but for
 * staff — every action here is its own reachable POST endpoint, and a STAFF
 * session must never be able to touch a booking outside its own venue
 * (checked again per-action below, not just by whatever page rendered the
 * form) while OWNER/MANAGER can touch any venue's booking.
 */
async function requireVenueAccess(
  venueId: string,
): Promise<{ staffUserId: string } | { error: string }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Not signed in." };
  if (session.role === "STAFF" && session.venueId !== venueId) {
    return { error: "That booking doesn't belong to your venue." };
  }
  return { staffUserId: session.staffUserId };
}

export async function updateBookingDetails(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  if (!customerName) return { error: "Customer name is required." };
  if (!customerEmail || !customerEmail.includes("@")) return { error: "A valid customer email is required." };
  const customerPhone = String(formData.get("customerPhone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const partySizeRaw = Number(formData.get("partySize"));
  if (!Number.isFinite(partySizeRaw) || partySizeRaw < 1) {
    return { error: "Party size must be at least 1." };
  }
  const partySize = Math.trunc(partySizeRaw);

  const statusRaw = String(formData.get("status") ?? "");
  if (!STATUSES.includes(statusRaw as BookingStatus)) return { error: `Invalid status: "${statusRaw}"` };
  const status = statusRaw as BookingStatus;

  await prisma.booking.update({
    where: { id },
    data: { customerName, customerEmail, customerPhone, notes, partySize, status },
  });

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}`);
}

export async function reassignTables(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({
    where: { id, venueId },
    select: { id: true, date: true, startTime: true, endTime: true },
  });
  if (!booking) return { error: "Booking not found for this venue." };

  const tableIds = formData.getAll("tableIds").map(String).filter(Boolean);
  if (tableIds.length > 0) {
    const validTables = await prisma.table.count({ where: { id: { in: tableIds }, venueId } });
    if (validTables !== tableIds.length) return { error: "One or more selected tables don't belong to this venue." };

    const conflicts = await findTableConflicts({
      venueId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      tableIds,
      excludeBookingId: id,
    });
    if (conflicts.length > 0) {
      const names = [...new Set(conflicts.map((c) => `${c.tableLabel} (${c.customerName}, ${c.startTime}-${c.endTime})`))];
      return { error: `Can't assign — already booked at this time: ${names.join(", ")}.` };
    }
  }

  await prisma.$transaction([
    prisma.bookingTable.deleteMany({ where: { bookingId: id } }),
    ...(tableIds.length > 0
      ? [prisma.bookingTable.createMany({ data: tableIds.map((tableId) => ({ bookingId: id, tableId })) })]
      : []),
  ]);

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
}
