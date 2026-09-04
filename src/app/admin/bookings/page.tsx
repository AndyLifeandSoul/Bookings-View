import Link from "next/link";
import { ClipboardList, Filter, X } from "lucide-react";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { getAllBookings, listBookingTypeNames, type AllBookingsSort } from "@/lib/admin/get-all-bookings";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { ClickableRow } from "@/components/clickable-row";

export const dynamic = "force-dynamic";

interface SearchParams {
  venueId?: string;
  bookingType?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}

const SORT_OPTIONS: { value: AllBookingsSort; label: string }[] = [
  { value: "receivedDesc", label: "Received (latest first)" },
  { value: "receivedAsc", label: "Received (earliest first)" },
  { value: "bookingDesc", label: "Booking date (latest first)" },
  { value: "bookingAsc", label: "Booking date (earliest first)" },
];

function isSort(value: string | undefined): value is AllBookingsSort {
  return SORT_OPTIONS.some((o) => o.value === value);
}

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Cross-venue confirmed bookings, filterable by venue, booking type, and date range, sortable by when the booking was made or when it's for. */
export default async function AdminAllBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [venues, bookingTypeNames] = await Promise.all([listActiveVenues(), listBookingTypeNames()]);

  const sort: AllBookingsSort = isSort(params.sort) ? params.sort : "receivedDesc";

  // No explicit "Date from" means only upcoming bookings show - a booking
  // that's already happened drops off the list on its own. To look back at
  // one that's passed, set "Date from" (and optionally "Date to") to reach
  // back before today; that's an explicit ask so it's honoured exactly.
  const filters = {
    venueId: params.venueId || undefined,
    bookingTypeName: params.bookingType || undefined,
    dateFrom: params.dateFrom ? new Date(`${params.dateFrom}T00:00:00.000Z`) : startOfTodayUTC(),
    dateTo: params.dateTo ? new Date(`${params.dateTo}T00:00:00.000Z`) : undefined,
    sort,
  };

  const bookings = await getAllBookings(filters);
  const hasFilters = Boolean(params.venueId || params.bookingType || params.dateFrom || params.dateTo);

  return (
    <div className="animate-in mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">All bookings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upcoming confirmed bookings across every venue, {bookings.length} shown. Set &quot;Date from&quot; to look back at ones that have already happened.
        </p>
      </div>

      <Card className="mt-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Sort</span>
            <select name="sort" defaultValue={sort} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonStyles("primary", "md")}>
            <Filter className="h-3.5 w-3.5" strokeWidth={2.25} />
            Filter
          </button>
          {hasFilters && (
            <Link href="/admin/bookings" className={buttonStyles("ghost", "md")}>
              <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              Clear
            </Link>
          )}
        </form>
      </Card>

      {bookings.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <ClipboardList className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No confirmed bookings match these filters.</p>
        </Card>
      ) : (
        <Card padded={false} className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5">Venue</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Guests</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Received</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const href = `/staff/${b.venueSlug}/bookings/${b.id}`;
                  return (
                    <ClickableRow
                      key={b.id}
                      href={href}
                      className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40"
                    >
                      <td className="px-4 py-3 text-zinc-600">{b.venueName}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatDate(b.date)}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-600">
                        {b.startTime}–{b.endTime}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-600">{b.partySize}</td>
                      <td className="px-4 py-3 text-zinc-600">{b.bookingTypeName}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={href} className="transition-colors hover:text-[var(--accent)] hover:underline">
                          {b.customerName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{formatDate(b.createdAt)}</td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
