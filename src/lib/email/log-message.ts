import { prisma } from "@/lib/db/client";

/**
 * Records a system-sent customer email as an OUTBOUND Message on the
 * booking, so the booking's (and customer's) message thread shows what was
 * sent, not only replies received. Andy wants the thread to be a real
 * two-way inbox, "both sent and received", and staff replies already log
 * themselves (see bookings-view's sendReply); this covers the automated
 * emails (confirmation, reminder, follow-up, payment reminder).
 *
 * Best-effort: called only after the email actually sent, and never allowed
 * to throw, so a logging hiccup can't roll back a booking or break the
 * emails cron. read defaults to true (an outbound message needs no
 * attention), staffUserId stays null (no person sent it).
 */
export async function logOutboundEmail(bookingId: string, subject: string, body: string): Promise<void> {
  try {
    await prisma.message.create({
      data: { bookingId, direction: "OUTBOUND", subject, body, read: true },
    });
  } catch (err) {
    console.error(`Failed to log outbound email as a Message for booking ${bookingId}:`, err);
  }
}
