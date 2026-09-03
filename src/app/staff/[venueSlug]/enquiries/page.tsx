import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";

export const dynamic = "force-dynamic";

/** Open ENQUIRY-status bookings for this venue — over-threshold parties and manually-added enquiries staff still need to review/confirm/close. Click through to the booking details page to act on one. */
export default async function EnquiriesPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const enquiries = await prisma.booking.findMany({
    where: { venueId: venue.id, status: "ENQUIRY" },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { bookingType: { select: { name: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Enquiries</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Bookings waiting for staff to confirm, respond to, or close — large parties over a booking type&apos;s
            threshold, and anything added manually as an enquiry.
          </p>
        </div>
        <Link
          href={`/staff/${venue.slug}/enquiries/new`}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Add enquiry
        </Link>
      </div>

      {enquiries.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No open enquiries.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Guests</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Contact</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((enquiry) => (
                <tr key={enquiry.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">
                    <Link href={`/staff/${venue.slug}/bookings/${enquiry.id}`} className="hover:underline">
                      {formatDate(enquiry.date)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{enquiry.startTime}</td>
                  <td className="px-4 py-2.5">{enquiry.partySize}</td>
                  <td className="px-4 py-2.5">{enquiry.bookingType.name}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/staff/${venue.slug}/bookings/${enquiry.id}`} className="hover:underline">
                      {enquiry.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{enquiry.customerPhone ?? enquiry.customerEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
