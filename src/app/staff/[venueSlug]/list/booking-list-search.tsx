"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, CalendarX2, UtensilsCrossed } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export interface ListBooking {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  partySize: number;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  bookingRef: string | null;
  notes: string | null;
  bookingType: { name: string };
  /** Present (non-null) once a customer has submitted a pre-order for this booking, see Booking.preOrder. Only its presence matters here, not its contents. */
  preOrder: { id: string } | null;
}

/**
 * Client-side search over the list view's already-fetched upcoming
 * bookings (see getUpcomingBookingsForVenue's 200-row cap) - matches name,
 * email, phone or booking reference, whichever field the customer used
 * when a member of staff calls in asking to find them. Filtering client-
 * side rather than round-tripping to the server keeps results instant as
 * staff type, and this list is already bounded to one venue's upcoming
 * bookings, never the kind of dataset that needs server-side search.
 */
export function BookingListSearch({ bookings, venueSlug }: { bookings: ListBooking[]; venueSlug: string }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => {
      return (
        b.customerName.toLowerCase().includes(q) ||
        (b.customerEmail?.toLowerCase().includes(q) ?? false) ||
        (b.customerPhone?.toLowerCase().includes(q) ?? false) ||
        (b.bookingRef?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [bookings, query]);

  const byDate = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <>
      <label className="relative mt-6 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={2.25} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone or booking reference"
          className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm"
        />
      </label>

      <div className="mt-6 flex flex-col gap-8">
        {byDate.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <CalendarX2 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-zinc-500">{query ? "No bookings match that search." : "No upcoming bookings."}</p>
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
                            href={`/staff/${venueSlug}/bookings/${booking.id}`}
                            className="transition-colors hover:text-[var(--accent)] hover:underline"
                          >
                            {booking.startTime}–{booking.endTime}
                          </Link>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-600">{booking.partySize}</td>
                        <td className="px-4 py-3 text-zinc-600">{booking.bookingType.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/staff/${venueSlug}/bookings/${booking.id}`}
                              className="font-medium text-zinc-900 transition-colors hover:text-[var(--accent)] hover:underline"
                            >
                              {booking.customerName}
                            </Link>
                            {booking.preOrder && (
                              <UtensilsCrossed
                                className="h-3.5 w-3.5 shrink-0 text-[var(--success-soft-text)]"
                                strokeWidth={2.25}
                                aria-label="Pre-order received"
                              />
                            )}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {booking.customerPhone ?? booking.customerEmail}
                            {booking.bookingRef ? ` · ${booking.bookingRef}` : ""}
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
    </>
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
