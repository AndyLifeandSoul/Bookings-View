import { sendVenueMail } from "./send";
import { renderVenueEmail, type VenueBrand } from "./templates";
import { logOutboundEmail } from "./log-message";

/**
 * Sends the branded booking/enquiry confirmation for a staff-entered
 * booking and logs it onto the booking's message thread, mirroring what the
 * customer-facing widget already does in lifeandsoul-bookings'
 * create-booking. The staff "Add booking" / "Add enquiry" actions
 * (createManualBooking / createManualEnquiry) never sent this, so a
 * phoned-in booking got no confirmation and the thread showed nothing sent,
 * unlike an online booking. The copy, details block and subject lines are
 * kept identical to create-booking's so both entry points look the same to
 * the customer.
 *
 * Best-effort, exactly like the widget: sendVenueMail never throws (returns
 * ok:false instead), the thread log is written only after a successful send,
 * and the whole thing no-ops when there's no venue mailbox or no customer
 * email to send to, so a booking is never held up or rolled back over email.
 */
interface VenueForEmail {
  name: string;
  email: string | null;
  logoUrl: string | null;
  brandColorHex: string | null;
  address: string | null;
  phone: string | null;
}

export async function sendBookingConfirmationEmail(params: {
  venue: VenueForEmail;
  bookingId: string;
  bookingRef: string | null;
  customerName: string;
  customerEmail: string | null;
  /** dayStart: UTC midnight standing for the venue-local calendar day. */
  date: Date;
  startTime: string;
  partySize: number;
  isEnquiry: boolean;
  bookingTypeName: string;
}): Promise<void> {
  const { venue, customerEmail } = params;
  if (!venue.email || !customerEmail) return;

  const brand: VenueBrand = {
    name: venue.name,
    logoUrl: venue.logoUrl,
    brandColorHex: venue.brandColorHex,
    address: venue.address,
    phone: venue.phone,
    email: venue.email,
  };

  // date is UTC-midnight standing for the venue-local day, so format in UTC
  // to always show that same calendar day (same convention as create-booking).
  const dateLabel = params.date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const details = [
    ...(params.bookingRef ? [{ label: "Reference", value: params.bookingRef }] : []),
    { label: "Date", value: dateLabel },
    { label: "Time", value: params.startTime },
    { label: "Booking type", value: params.bookingTypeName },
    { label: "Party size", value: String(params.partySize) },
  ];

  const rendered = renderVenueEmail(
    brand,
    params.isEnquiry
      ? {
          heading: "We've received your enquiry",
          intro: [
            `Hi ${params.customerName},`,
            `Thanks for your enquiry at ${venue.name}. We'll be in touch shortly to confirm.`,
          ],
          details,
          outro: ["Reply to this email if you need to change anything."],
        }
      : {
          heading: "Your booking is confirmed",
          intro: [
            `Hi ${params.customerName},`,
            `Your booking at ${venue.name} is confirmed. We look forward to seeing you.`,
          ],
          details,
          outro: ["Reply to this email if you need to change or cancel."],
        },
  );
  const subject = params.isEnquiry
    ? `We've received your enquiry${params.bookingRef ? ` ${params.bookingRef}` : ""} for ${venue.name}`
    : `Your booking is confirmed${params.bookingRef ? ` (${params.bookingRef})` : ""} for ${venue.name}`;

  const result = await sendVenueMail({
    mailbox: venue.email,
    to: customerEmail,
    subject,
    text: rendered.text,
    html: rendered.html,
  });
  if (result.ok) {
    await logOutboundEmail(params.bookingId, subject, rendered.text);
  }
}
