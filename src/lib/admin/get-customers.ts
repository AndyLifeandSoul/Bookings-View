import { prisma } from "@/lib/db/client";

export interface CustomerFilters {
  venueId?: string;
  marketingOptIn?: boolean;
  /** Bookings on or after this date (inclusive). */
  dateFrom?: Date;
  /** Bookings on or before this date (inclusive). */
  dateTo?: Date;
  /** 1-12 — customers whose customerDateOfBirth falls in this calendar month, any year. */
  birthdayMonth?: number;
}

export interface Customer {
  email: string | null;
  name: string;
  phone: string | null;
  dateOfBirth: Date | null;
  marketingOptIn: boolean;
  venueNames: string[];
  bookingCount: number;
  lastBookingDate: Date;
}

/**
 * One row per customer, across every venue they've booked at — the admin
 * Customers page's data source. Deduped by email (case-insensitively) when
 * a booking has one; a booking with no email (a same-day manual "Add
 * booking" with only a phone number — see Booking.customerEmail's doc
 * comment) is deduped by phone instead, and one with neither is never
 * merged with anything else (each such booking is its own "customer" row —
 * there's nothing to safely match it on). The most recent booking wins for
 * name/phone/DOB/marketing-opt-in (the freshest info about that person),
 * but venueNames/bookingCount reflect every booking, not just the latest.
 *
 * Filters apply to the underlying bookings *before* dedup — e.g. a venue
 * filter only counts a customer if they have a booking at that venue, a
 * date range only counts bookings within it — except birthdayMonth, which
 * is a property of the person, not a booking, so it's applied after dedup.
 */
export async function getCustomers(filters: CustomerFilters): Promise<Customer[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      venueId: filters.venueId,
      // Walk-ins are table blockers, not customers — see Booking.isWalkIn's
      // doc comment. Excluded here so they never reach the Customers page or
      // (since this is that page's data source) its CSV export either.
      isWalkIn: false,
      ...(filters.dateFrom || filters.dateTo
        ? { date: { gte: filters.dateFrom, lte: filters.dateTo } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerDateOfBirth: true,
      marketingOptIn: true,
      date: true,
      venue: { select: { name: true } },
    },
  });

  const byKey = new Map<string, Customer>();
  for (const b of bookings) {
    const key = b.customerEmail
      ? `email:${b.customerEmail.toLowerCase()}`
      : b.customerPhone
        ? `phone:${b.customerPhone.replace(/\s+/g, "")}`
        : `booking:${b.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        email: b.customerEmail,
        name: b.customerName,
        phone: b.customerPhone,
        dateOfBirth: b.customerDateOfBirth,
        marketingOptIn: b.marketingOptIn,
        venueNames: [b.venue.name],
        bookingCount: 1,
        lastBookingDate: b.date,
      });
    } else {
      existing.bookingCount += 1;
      if (!existing.venueNames.includes(b.venue.name)) existing.venueNames.push(b.venue.name);
      if (b.date > existing.lastBookingDate) existing.lastBookingDate = b.date;
    }
  }

  let customers = [...byKey.values()];

  if (filters.marketingOptIn !== undefined) {
    customers = customers.filter((c) => c.marketingOptIn === filters.marketingOptIn);
  }
  if (filters.birthdayMonth) {
    customers = customers.filter((c) => c.dateOfBirth != null && c.dateOfBirth.getUTCMonth() + 1 === filters.birthdayMonth);
  }

  return customers.sort((a, b) => a.name.localeCompare(b.name));
}
