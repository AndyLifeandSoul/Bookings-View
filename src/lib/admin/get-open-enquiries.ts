import { prisma } from "@/lib/db/client";

export interface OpenEnquiry {
  id: string;
  venueSlug: string;
  venueName: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  partySize: number;
  date: Date;
  startTime: string;
  bookingTypeName: string;
  createdAt: Date;
}

/**
 * Every open enquiry (Booking.status "ENQUIRY") across every venue - the
 * dedicated cross-venue Enquiries admin tab's data source. Was previously
 * just the top 50 shown on the Home dashboard; that box is gone now this
 * page exists (see admin/page.tsx), so this has no cap - a pilot-sized
 * operation isn't going to produce thousands of simultaneously open
 * enquiries, and if it ever does, that's exactly the kind of thing this
 * page exists to surface, not hide behind a limit.
 */
export async function getOpenEnquiries(): Promise<OpenEnquiry[]> {
  const rows = await prisma.booking.findMany({
    where: { status: "ENQUIRY" },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      partySize: true,
      date: true,
      startTime: true,
      createdAt: true,
      venue: { select: { slug: true, name: true } },
      bookingType: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    venueSlug: r.venue.slug,
    venueName: r.venue.name,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    partySize: r.partySize,
    date: r.date,
    startTime: r.startTime,
    bookingTypeName: r.bookingType.name,
    createdAt: r.createdAt,
  }));
}
