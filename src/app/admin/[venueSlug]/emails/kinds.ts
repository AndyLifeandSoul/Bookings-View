/**
 * The guest emails a venue can reword, with the standard wording the
 * customer app uses when nothing is set (keep in step with
 * lifeandsoul-bookings confirmation-email.ts and cron/booking-emails).
 */
export const EMAIL_KINDS = [
  {
    kind: "confirmation",
    title: "Booking confirmed",
    when: "As soon as a booking is confirmed, or once it's paid for.",
    heading: "You're booked in",
    subject: "You're booked in at {venue} ({ref})",
    intro: "Hi {name},\n\nYou're booked in at {venue}. We look forward to seeing you.",
  },
  {
    kind: "reminder",
    title: "Reminder",
    when: "About 24 hours before the booking.",
    heading: "See you soon",
    subject: "Reminder: your booking at {venue}",
    intro: "Hi {name},\n\nJust a reminder about your booking at {venue}.",
  },
  {
    kind: "follow_up",
    title: "Thank you",
    when: "The morning after the visit, with your Google review link if you've added one.",
    heading: "Thanks for coming in",
    subject: "Thanks for visiting {venue}",
    intro: "Hi {name},\n\nThanks for coming to {venue}, we hope you had a great time.",
  },
] as const;

export type EmailKindKey = (typeof EMAIL_KINDS)[number]["kind"];
