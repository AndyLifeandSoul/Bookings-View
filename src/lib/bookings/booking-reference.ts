/**
 * Mirror of lifeandsoul-bookings' lib/bookings/booking-reference.ts — used
 * here for the manual "Add booking"/"Add enquiry" staff flows, which need
 * to generate the same reference format as the customer widget's bookings.
 * See that file for the full doc comment on the format's reasoning; kept in
 * sync by hand, same as schema.prisma and lib/bookings/time.ts.
 */
export function formatBookingRef(venueCode: string, date: Date, sequence: number): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const seq = String(sequence).padStart(2, "0");
  return `${venueCode}-${dd}${mm}${seq}`;
}
