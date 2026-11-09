/**
 * Bookings that came across from DesignMyNight (Collins) during the
 * crossover keep their DMN- reference, and those guests already get their
 * emails from DesignMyNight. None of the automated guest emails here
 * (confirmations, changes, cancellations, reminders, follow-ups, payment
 * and pre-order emails) goes to them. Venue alerts and staff replies typed
 * by hand are unaffected.
 */
export function guestEmailsHandledElsewhere(bookingRef: string | null | undefined): boolean {
  return !!bookingRef && /^DMN-/i.test(bookingRef.trim());
}
