import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Adds a line to a booking's change history (BookingEvent), shown on the
 * booking screen. Never throws: a failed history write must not undo or
 * block the change it describes.
 */
export async function logBookingEvent(
  params: { bookingId: string; actor: string; kind: string; detail: string },
  db: Db = prisma,
): Promise<void> {
  try {
    await db.bookingEvent.create({ data: params });
  } catch (err) {
    console.error("[booking-events] failed to log", params.kind, err);
  }
}
