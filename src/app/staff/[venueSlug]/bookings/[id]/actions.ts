"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { findTableConflicts } from "@/lib/staff/table-conflicts";
import { sendMailAs } from "@/lib/email/graph-client";
import type { ActionResult } from "@/components/action-form";
import type { BookingStatus } from "@/generated/prisma";

const STATUSES: BookingStatus[] = ["ENQUIRY", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"];

/**
 * Same "trust nothing but the session" shape as requireAdminSession, but for
 * staff - every action here is its own reachable POST endpoint, and a STAFF
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
  if (!customerName) return { error: "Customer name is required." };
  const customerEmailRaw = String(formData.get("customerEmail") ?? "").trim();
  if (customerEmailRaw && !customerEmailRaw.includes("@")) return { error: "Email doesn't look valid." };
  const customerEmail = customerEmailRaw || null;
  const customerPhone = String(formData.get("customerPhone") ?? "").trim() || null;
  if (!customerEmail && !customerPhone) return { error: "Enter at least one of email or phone." };
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
      return { error: `Can't assign, already booked at this time: ${names.join(", ")}.` };
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

/**
 * Sends a reply as the venue's mailbox (Venue.email) via Graph and logs it
 * as an OUTBOUND Message either way - even when Graph isn't configured or
 * the send fails, so staff always have a record of what they meant to say,
 * with the send failure surfaced as the action's error rather than losing
 * the message text. read defaults to true for OUTBOUND (see Message.read's
 * doc comment), so this never shows up as something needing attention.
 */
export async function sendReply(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message can't be empty." };

  const booking = await prisma.booking.findFirst({
    where: { id, venueId },
    select: { id: true, customerEmail: true, bookingRef: true, venue: { select: { name: true, email: true } } },
  });
  if (!booking) return { error: "Booking not found for this venue." };

  const session = await getCurrentStaffSession();
  const subject = `Re: your booking${booking.bookingRef ? ` ${booking.bookingRef}` : ""} at ${booking.venue.name}`;

  let sendError: string | null = null;
  if (!booking.venue.email) {
    sendError = "This venue has no email address set (Settings → Venue Details), logged only, not sent.";
  } else if (!booking.customerEmail) {
    sendError = "This booking has no customer email on file, logged only, not sent.";
  } else {
    const result = await sendMailAs(booking.venue.email, booking.customerEmail, subject, body);
    if (!result.ok) sendError = `Logged, but sending failed: ${result.error}`;
  }

  await prisma.message.create({
    data: {
      bookingId: id,
      direction: "OUTBOUND",
      subject,
      body,
      staffUserId: session?.staffUserId,
    },
  });

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  if (sendError) return { error: sendError };
}

/** Marks every unread inbound message on this booking read - called when staff open/action a booking from the Messages tab. */
export async function markMessagesRead(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  await prisma.message.updateMany({
    where: { bookingId: id, direction: "INBOUND", read: false, booking: { venueId } },
    data: { read: true },
  });

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}/messages`);
}

/**
 * Marks a booking as arrived. Doesn't affect table-conflict/availability
 * checks at all (see Booking.checkedInAt's doc comment) - purely a record
 * of "they're here", so staff can see who's actually in at a glance.
 */
export async function checkInBooking(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  await prisma.booking.update({ where: { id }, data: { checkedInAt: new Date() } });
  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}/diary`);
}

/**
 * Marks a booking's table as cleared - from this point on it's excluded
 * from every table-conflict/availability check regardless of how much of
 * its formally booked window remains, so it's immediately bookable again.
 * See Booking.checkedOutAt's doc comment.
 */
export async function checkOutBooking(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  // checkedInAt is deliberately left untouched (not cleared) - checking out
  // still implies they were checked in at some point, and "when did they
  // arrive" stays a useful fact after the table's freed up. Status moves to
  // COMPLETED at the same time (Andy's spec) so a checked-out booking reads
  // as finished everywhere status is shown (list view, All Bookings), not
  // just on the diary via checkedOutAt.
  await prisma.booking.update({ where: { id }, data: { checkedOutAt: new Date(), status: "COMPLETED" } });
  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}/diary`);
  revalidatePath(`/staff/${venueSlug}/list`);
  revalidatePath("/admin/bookings");
}

/**
 * Undoes an accidental check-out, the table goes back to being occupied by
 * this booking for conflict-checking purposes. Also reverts the automatic
 * COMPLETED status checkOutBooking sets, back to CONFIRMED, symmetric with
 * that action: checking out only ever happens from an active booking, so
 * undoing it restores that active state rather than leaving it stuck on
 * COMPLETED.
 */
export async function undoCheckOut(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  await prisma.booking.update({ where: { id }, data: { checkedOutAt: null, status: "CONFIRMED" } });
  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}/diary`);
  revalidatePath(`/staff/${venueSlug}/list`);
  revalidatePath("/admin/bookings");
}
