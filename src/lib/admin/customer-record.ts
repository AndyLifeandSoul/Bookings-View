import { prisma } from "@/lib/db/client";

/**
 * The Customer table (see its doc comment in schema.prisma) is a durable,
 * cross-venue record keyed by email (lowercased) when present, else phone
 * (whitespace stripped) - the exact same identity get-customers.ts and the
 * data-retention cron use. This module is the shared read/write surface for
 * the two staff-facing features that touch it directly: editing a
 * customer's staff notes, and the on-demand GDPR erasure action. Both key
 * on that same identity so all four places (this file, get-customers.ts,
 * the cron's reconcile, the cron's scrub) agree on what "one customer" is.
 */

export interface CustomerIdentity {
  /** Lowercased, or null. */
  email: string | null;
  /** Whitespace stripped, or null. */
  phone: string | null;
}

/**
 * Normalises a booking's raw customerEmail/customerPhone into the same
 * identity key everything else uses, or null when the booking has neither
 * (an "unmergeable singleton" - see get-customers.ts - which can't own a
 * Customer row, and so can't own staff notes either).
 */
export function customerIdentity(email: string | null, phone: string | null): CustomerIdentity | null {
  const normEmail = email ? email.trim().toLowerCase() : null;
  const normPhone = phone ? phone.replace(/\s+/g, "") : null;
  if (!normEmail && !normPhone) return null;
  return { email: normEmail, phone: normEmail ? null : normPhone };
}

/** Finds the Customer row for an identity, or null if none exists yet (e.g. the cron hasn't reconciled it). */
async function findCustomerRow(identity: CustomerIdentity) {
  if (identity.email) {
    return prisma.customer.findUnique({ where: { email: identity.email } });
  }
  return prisma.customer.findFirst({ where: { email: null, phone: identity.phone } });
}

/** The staff notes stored for this identity, or "" if there's no row / no note yet. */
export async function getStaffNotes(identity: CustomerIdentity): Promise<string> {
  const row = await findCustomerRow(identity);
  return row?.staffNotes ?? "";
}

/**
 * Sets (or clears, with an empty note) the staff notes for a customer,
 * creating the Customer row if the reconciliation cron hasn't yet. The cron
 * only ever writes name/dateOfBirth/marketingOptIn/lastBookingDate (see
 * reconcileCustomers), never staffNotes, so a row created here purely to
 * hold a note is safely filled in by the cron on its next run without ever
 * clobbering the note. `name` and `seedBookingDate` are only used when
 * creating the row (from the booking the note was entered against); on an
 * existing row only staffNotes changes.
 */
export async function setStaffNotes(params: {
  identity: CustomerIdentity;
  name: string;
  seedBookingDate: Date;
  notes: string;
}): Promise<void> {
  const staffNotes = params.notes.trim() || null;
  const { identity } = params;

  const existing = await findCustomerRow(identity);
  if (existing) {
    await prisma.customer.update({ where: { id: existing.id }, data: { staffNotes } });
    return;
  }

  await prisma.customer.create({
    data: {
      email: identity.email,
      phone: identity.phone,
      name: params.name,
      lastBookingDate: params.seedBookingDate,
      staffNotes,
    },
  });
}

/**
 * On-demand GDPR erasure: scrubs a customer's personal data immediately,
 * regardless of any retention window, for a "delete my data" request. Nulls
 * the identity fields on every one of their Booking rows (the booking
 * itself survives - id/date/status/party size stay, only who it was for is
 * removed) and deletes their Customer row (which takes staffNotes with it).
 * This is the same scrub the data-retention cron's scrubExpiredCustomers
 * applies on a timer, just triggered by staff on request; kept as its own
 * copy here rather than shared because the cron lives in the other repo
 * (lifeandsoul-bookings), like the rest of what these two duplicate.
 *
 * Returns how many Booking rows were scrubbed, for the confirmation
 * message. A no-op (0 bookings, no Customer row) is not an error - it just
 * means there was nothing left to erase.
 */
export async function eraseCustomerData(identity: CustomerIdentity): Promise<{ bookingsScrubbed: number }> {
  const scrubData = {
    customerName: "Deleted customer",
    customerEmail: null,
    customerPhone: null,
    customerDateOfBirth: null,
    marketingOptIn: false,
  };

  if (identity.email) {
    const [updated] = await prisma.$transaction([
      prisma.booking.updateMany({
        where: { customerEmail: { equals: identity.email, mode: "insensitive" } },
        data: scrubData,
      }),
      prisma.customer.deleteMany({ where: { email: identity.email } }),
    ]);
    return { bookingsScrubbed: updated.count };
  }

  // Phone-only: Booking.customerPhone is stored raw (whitespace and all)
  // while Customer.phone is stored stripped, so no single query can compare
  // them - fetch candidates and match in JS, then update by id. Same
  // approach as the cron's scrubExpiredCustomers.
  const candidates = await prisma.booking.findMany({
    where: { customerEmail: null, customerPhone: { not: null } },
    select: { id: true, customerPhone: true },
  });
  const matchingIds = candidates
    .filter((b) => b.customerPhone!.replace(/\s+/g, "") === identity.phone)
    .map((b) => b.id);

  const [updated] = await prisma.$transaction([
    prisma.booking.updateMany({ where: { id: { in: matchingIds } }, data: scrubData }),
    prisma.customer.deleteMany({ where: { email: null, phone: identity.phone } }),
  ]);
  return { bookingsScrubbed: updated.count };
}
