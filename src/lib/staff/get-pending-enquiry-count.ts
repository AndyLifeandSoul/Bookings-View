import { prisma } from "@/lib/db/client";

/** Count of open ENQUIRY-status bookings for this venue — drives the Enquiries tab badge. */
export async function getPendingEnquiryCount(venueId: string): Promise<number> {
  return prisma.booking.count({ where: { venueId, status: "ENQUIRY" } });
}
