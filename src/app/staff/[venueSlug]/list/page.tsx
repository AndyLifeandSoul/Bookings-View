import Link from "next/link";
import { Plus, MessageCirclePlus, LayoutGrid, CalendarX2 } from "lucide-react";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { getUpcomingBookingsForVenue } from "@/lib/staff/get-bookings-for-venue";
import { StatusBadge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * The list view, moved here from bare /staff/[venueSlug] (now the Diary,
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
      <div className="animate-in mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{venue.name}, list view</h1>
            <p className="text-sm text-zinc-500">Every upcoming booking, in one list.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/staff/${venue.slug}/bookings/new`} className={buttonStyles("primary", "sm")}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Add booking
            </Link>
            <Link href={`/staff/${venue.slug}/enquiries/new`} className={buttonStyles("secondary", "sm")}>
              <MessageCirclePlus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Add enquiry
            </Link>
            <Link href={`/staff/${venue.slug}/diary`} className={buttonStyles("ghost", "sm")}>
              <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.25} />
              Table view
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-8">
          {byDate.length === 0 && (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <CalendarX2 className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="text-sm text-zinc-500">No upcoming bookings.</p>
            </Card>
          )}
          {byDate.map(({ dateKey, label, rows }) => (
            <section key={dateKey}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                {label} <span className="font-normal text-zinc-400">({rows.length})</span>
              </h2>
              <Card padded={false} className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-2.5">Time</th>
                        <th className="px-4 py-2.5">Guests</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((booking) => (
                        <tr key={booking.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            <Link
                              href={`/staff/${venue.slug}/bookings/${booking.id}`}
                              className="transition-colors hover:text-[var(--accent)] hover:underline"
                            >
                              {booking.startTime}–{booking.endTime}
                            </Link>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-zinc-600">{booking.partySize}</td>
                          <td className="px-4 py-3 text-zinc-600">{booking.bookingType.name}</td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/staff/${venue.slug}/bookings/${booking.id}`}
                              className="font-medium text-zinc-900 transition-colors hover:text-[var(--accent)] hover:underline"
                            >
                              {booking.customerName}
                            </Link>
                            <div className="text-xs text-zinc-500">
                              {booking.customerPhone ?? booking.customerEmail}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={booking.status} />
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{booking.notes ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
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
    // because Booking.date is stored as @db.Date (no time component), so
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
