import Link from "next/link";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { getCustomers } from "@/lib/admin/get-customers";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface SearchParams {
  venueId?: string;
  marketing?: string; // "" | "yes" | "no"
  dateFrom?: string;
  dateTo?: string;
  birthdayMonth?: string; // "" | "1".."12"
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const venues = await listActiveVenues();

  const filters = {
    venueId: params.venueId || undefined,
    marketingOptIn: params.marketing === "yes" ? true : params.marketing === "no" ? false : undefined,
    dateFrom: params.dateFrom ? new Date(`${params.dateFrom}T00:00:00.000Z`) : undefined,
    dateTo: params.dateTo ? new Date(`${params.dateTo}T00:00:00.000Z`) : undefined,
    birthdayMonth: params.birthdayMonth ? Number(params.birthdayMonth) : undefined,
  };

  const customers = await getCustomers(filters);
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Customers</h1>
          <p className="mt-1 text-sm text-zinc-500">Every customer who has ever booked, across every venue — {customers.length} shown.</p>
        </div>
        <Link
          href={`/api/admin/customers-export${exportQuery ? `?${exportQuery}` : ""}`}
          className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Export CSV
        </Link>
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
          <span className="text-xs font-medium text-zinc-600">Marketing</span>
          <select name="marketing" defaultValue={params.marketing ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Any</option>
            <option value="yes">Opted in</option>
            <option value="no">Not opted in</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Booking from</span>
          <input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Booking to</span>
          <input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Birthday month</span>
          <select name="birthdayMonth" defaultValue={params.birthdayMonth ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Any</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Filter
        </button>
        {(params.venueId || params.marketing || params.dateFrom || params.dateTo || params.birthdayMonth) && (
          <Link href="/admin/customers" className="text-sm text-zinc-500 underline hover:text-zinc-900">
            Clear
          </Link>
        )}
      </form>

      {customers.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No customers match these filters.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Venue(s)</th>
                <th className="px-4 py-2">Bookings</th>
                <th className="px-4 py-2">Last booking</th>
                <th className="px-4 py-2">Marketing</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.email} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">{c.name}</td>
                  <td className="px-4 py-2.5 text-zinc-600">
                    <div>{c.email ?? "—"}</div>
                    {c.phone && <div className="text-xs text-zinc-400">{c.phone}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{c.venueNames.join(", ")}</td>
                  <td className="px-4 py-2.5">{c.bookingCount}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{formatDate(c.lastBookingDate)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.marketingOptIn ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {c.marketingOptIn ? "Opted in" : "No"}
                    </span>
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
