import Link from "next/link";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { getAllBookings, listBookingTypeNames } from "@/lib/admin/get-all-bookings";

export const dynamic = "force-dynamic";

interface SearchParams {
  venueId?: string;
  bookingType?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Cross-venue confirmed bookings, filterable by venue, booking type, and date range. */
export default async function AdminAllBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [venues, bookingTypeNames] = await Promise.all([listActiveVenues(), listBookingTypeNames()]);

  const filters = {
    venueId: params.venueId || undefined,
    bookingTypeName: params.bookingType || undefined,
    dateFrom: params.dateFrom ? new Date(`${params.dateFrom}T00:00:00.000Z`) : undefined,
    dateTo: params.dateTo ? new Date(`${params.dateTo}T00:00:00.000Z`) : undefined,
  };

  const bookings = await getAllBookings(filters);
  const hasFilters = Boolean(params.venueId || params.bookingType || params.dateFrom || params.dateTo);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">All bookings</h1>
        <p className="mt-1 text-sm text-zinc-500">Every confirmed booking across every venue — {bookings.length} shown.</p>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Venue</span>
          <select name="venueId" defaultValue={params.venueId ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Any venue</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Booking type</span>
          <select name="bookingType" defaultValue={params.bookingType ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Any type</option>
            {bookingTypeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Date from</span>
          <input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Date to</span>
          <input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Filter
        </button>
        {hasFilters && (
          <Link href="/admin/bookings" className="text-sm text-zinc-500 underline hover:text-zinc-900">
            Clear
          </Link>
        )}
      </form>

      {bookings.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No confirmed bookings match these filters.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Venue</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Guests</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Customer</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 text-zinc-600">{b.venueName}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{formatDate(b.date)}</td>
                  <td className="px-4 py-2.5 text-zinc-600">
                    {b.startTime}–{b.endTime}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{b.partySize}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{b.bookingTypeName}</td>
                  <td className="px-4 py-2.5 font-medium text-zinc-900">
                    <Link href={`/staff/${b.venueSlug}/bookings/${b.id}`} className="hover:underline">
                      {b.customerName}
                    </Link>
                  </td>
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
