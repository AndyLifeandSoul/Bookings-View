import { prisma } from "@/lib/db/client";

/** Count of unread inbound messages for this venue's bookings — drives the Messages tab badge. See Message.read's doc comment for why only INBOUND matters here. */
export async function getUnreadMessageCount(venueId: string): Promise<number> {
  return prisma.message.count({
    where: { direction: "INBOUND", read: false, booking: { venueId } },
  });
}
