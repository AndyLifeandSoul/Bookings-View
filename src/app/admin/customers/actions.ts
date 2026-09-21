"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { customerIdentity, eraseCustomerData } from "@/lib/admin/customer-record";
import type { ActionResult } from "@/components/action-form";

/**
 * On-demand GDPR erasure of one customer's personal data, for a "delete my
 * data" request. Nulls the identity fields on every Booking that customer
 * made (the booking itself survives, only who it was for is removed) and
 * deletes their Customer row and staff notes. Immediate and irreversible,
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
