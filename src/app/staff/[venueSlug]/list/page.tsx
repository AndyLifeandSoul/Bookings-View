import Link from "next/link";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { getUpcomingBookingsForVenue } from "@/lib/staff/get-bookings-for-venue";
import { StatusBadge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/**
 * The list view — moved here from bare /staff/[venueSlug] (now the Diary,
 * see ../page.tsx's redirect) per Andy's "Table View should be the default,
 * List view should only be used as an option for staff": this is reached
 * only via the "List view" link on the Diary page, never a top-level tab.
 */
export default async function StaffListPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const bookings = await getUpcomingBookingsForVenue(venue.id);
  const byDate = groupByDate(bookings);

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{venue.name} — List view</h1>
            <p className="text-sm text-zinc-500">Every upcoming booking, in one list.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/staff/${venue.slug}/bookings/new`}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Add booking
            </Link>
            <Link
              href={`/staff/${venue.slug}/enquiries/new`}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Add enquiry
            </Link>
            <Link href={`/staff/${venue.slug}/diary`} className="text-sm text-zinc-500 underline hover:text-zinc-900">
              Table view
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-8">
          {byDate.length === 0 && (
            <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
              No upcoming bookings.
            </p>
          )}
          {byDate.map(({ dateKey, label, rows }) => (
            <section key={dateKey}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                {label} <span className="font-normal text-zinc-400">({rows.length})</span>
              </h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Guests</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((booking) => (
                      <tr key={booking.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                        <td className="px-4 py-2 font-medium text-zinc-900">
                          <Link href={`/staff/${venue.slug}/bookings/${booking.id}`} className="hover:underline">
                            {booking.startTime}–{booking.endTime}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{booking.partySize}</td>
                        <td className="px-4 py-2">{booking.bookingType.name}</td>
                        <td className="px-4 py-2">
                          <Link href={`/staff/${venue.slug}/bookings/${booking.id}`} className="hover:underline">
                            {booking.customerName}
                          </Link>
                          <div className="text-xs text-zinc-500">
                            {booking.customerPhone ?? booking.customerEmail}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={booking.status} />
                        </td>
                        <td className="px-4 py-2 text-zinc-500">{booking.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function groupByDate<T extends { date: Date }>(rows: T[]): { dateKey: string; label: string; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    // .toISOString() on a UTC-midnight Date is safe here specifically
    // because Booking.date is stored as @db.Date (no time component) —
    // there's no local-timezone shift to worry about the way there would
    // be for a real timestamp.
    const key = row.date.toISOString().slice(0, 10);
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()].map(([dateKey, rows]) => ({
    dateKey,
    label: new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }),
    rows,
  }));
}
