"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { customerIdentity, eraseCustomerData, setCustomerProfile } from "@/lib/admin/customer-record";
import { prisma } from "@/lib/db/client";
import { tagsFromForm } from "@/lib/admin/guest-tags";
import type { ActionResult } from "@/components/action-form";

/**
 * On-demand GDPR erasure of one customer's personal data, for a "delete my
 * data" request. Nulls the identity fields, their notes, allergies and
 * staff notes on every Booking that customer made (the booking itself
 * survives, only who it was for is removed), deletes the emails stored on
 * those bookings, their waiting list and guest list entries, and their
 * Customer row. Immediate and irreversible,
 * regardless of the automatic retention windows the data-retention cron
 * applies on a timer. Admin-only (requireAdminSession blocks STAFF); the
 * two-step confirm lives in the button component (see
 * erase-customer-button.tsx), this just does the deletion.
 *
 * Keyed on the same email/phone identity as everything else (see
 * customer-record.ts). A row with neither can't be targeted this way and
 * the button isn't shown for it.
 */
export async function eraseCustomer(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();

  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const identity = customerIdentity(email, phone);
  if (!identity) return { error: "This customer has no email or phone to identify them by, nothing to erase." };

  await eraseCustomerData(identity);
  // On success the scrubbed bookings resurface as "Deleted customer" rows
  // (name nulled to that, no email/phone), which is the visible
  // confirmation - the shared ActionResult has no success-message channel,
  // so return nothing and let the refreshed list show the result.
  revalidatePath("/admin/customers");
}

/** Tags, allergies and private notes from the customer profile page, keyed by one of the guest's bookings. */
export async function updateCustomerProfile(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const bookingId = String(formData.get("bookingId") ?? "");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { customerName: true, customerEmail: true, customerPhone: true, date: true } });
  if (!booking) return { error: "That guest's booking no longer exists." };
  const identity = customerIdentity(booking.customerEmail, booking.customerPhone);
  if (!identity) return { error: "No email or phone to keep a guest record against." };
  await setCustomerProfile({
    identity,
    name: booking.customerName,
    seedBookingDate: booking.date,
    tags: tagsFromForm(formData),
    allergies: String(formData.get("allergies") ?? "").slice(0, 300),
    notes: String(formData.get("staffNotes") ?? "").slice(0, 2000),
  });
  revalidatePath(`/admin/customers/b/${bookingId}`);
}
