import Link from "next/link";
import { Download, Users } from "lucide-react";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { getCustomers } from "@/lib/admin/get-customers";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <div className="animate-in mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Customers</h1>
          <p className="mt-1 text-sm text-zinc-500">Every customer who has ever booked, across every venue, {customers.length} shown.</p>
        </div>
        <Link
          href={`/api/admin/customers-export${exportQuery ? `?${exportQuery}` : ""}`}
          className={buttonStyles("primary", "sm")}
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
          Export CSV
        </Link>
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
          <button type="submit" className={buttonStyles("primary", "sm")}>
            Filter
          </button>
          {(params.venueId || params.marketing || params.dateFrom || params.dateTo || params.birthdayMonth) && (
            <Link href="/admin/customers" className={buttonStyles("ghost", "sm")}>
              Clear
            </Link>
          )}
        </form>
      </Card>

      {customers.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No customers match these filters.</p>
        </Card>
      ) : (
        <Card padded={false} className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Venue(s)</th>
                  <th className="px-4 py-2.5">Bookings</th>
                  <th className="px-4 py-2.5">Last booking</th>
                  <th className="px-4 py-2.5">Marketing</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr
                    key={c.email ?? c.phone ?? `${c.name}-${i}`}
                    className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      <div>{c.email ?? "-"}</div>
                      {c.phone && <div className="text-xs text-zinc-400">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{c.venueNames.join(", ")}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600">{c.bookingCount}</td>
                    <td className="px-4 py-3 text-zinc-600">{formatDate(c.lastBookingDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.marketingOptIn ? "success" : "neutral"}>{c.marketingOptIn ? "Opted in" : "No"}</Badge>
                    </td>
                  </tr>
                ))}
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
