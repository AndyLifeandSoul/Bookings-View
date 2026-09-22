import { prisma } from "@/lib/db/client";

/** Count of unread inbound messages for this venue's bookings, drives the Messages tab badge. See Message.read's doc comment for why only INBOUND matters here. */
export async function getUnreadMessageCount(venueId: string): Promise<number> {
  return prisma.message.count({
    where: { direction: "INBOUND", read: false, booking: { venueId } },
  });
}


/** Count of unread inbound messages across EVERY venue, for the admin (cross-venue) Messages tab badge. OWNER/MANAGER only reach this, so it's deliberately unscoped. */
export async function getUnreadMessageCountAllVenues(): Promise<number> {
  return prisma.message.count({
    where: { direction: "INBOUND", read: false },
  });
}
