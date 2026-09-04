import Link from "next/link";
import { MessageCirclePlus, Inbox } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClickableRow } from "@/components/clickable-row";

export const dynamic = "force-dynamic";

/**
 * Open ENQUIRY-status bookings for this venue, over-threshold parties and
 * manually-added enquiries staff still need to review/confirm/close. Click
 * through to the booking details page to act on one.
 *
 * Grouped by date the same way the List view is (see that page) - reusing
 * an existing pattern in this app rather than inventing a new one, and it
 * matches how staff already think about the queue: "what's coming up
 * Friday" rather than one flat list sorted by nothing in particular to the
 * eye.
 */
export default async function EnquiriesPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const enquiries = await prisma.booking.findMany({
    where: { venueId: venue.id, status: "ENQUIRY" },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { bookingType: { select: { name: true } } },
  });
  const byDate = groupByDate(enquiries);

  return (
    <div className="animate-in mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Enquiries</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Bookings waiting for staff to confirm, respond to, or close, large parties over a booking type&apos;s
            threshold, and anything added manually as an enquiry.
          </p>
        </div>
        <Link href={`/staff/${venue.slug}/enquiries/new`} className={buttonStyles("primary", "sm")}>
          <MessageCirclePlus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Add enquiry
        </Link>
      </div>

      {byDate.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Inbox className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No open enquiries.</p>
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
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
                        <th className="px-4 py-2.5">Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((enquiry) => {
                        const href = `/staff/${venue.slug}/bookings/${enquiry.id}`;
                        return (
                          <ClickableRow
                            key={enquiry.id}
                            href={href}
                            className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40"
                          >
                            <td className="px-4 py-3 tabular-nums font-medium text-zinc-900">{enquiry.startTime}</td>
                            <td className="px-4 py-3 tabular-nums text-zinc-600">{enquiry.partySize}</td>
                            <td className="px-4 py-3 text-zinc-600">{enquiry.bookingType.name}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={href}
                                className="font-medium text-zinc-900 transition-colors hover:text-[var(--accent)] hover:underline"
                              >
                                {enquiry.customerName}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-zinc-500">
                              {enquiry.customerPhone ?? enquiry.customerEmail}
                            </td>
                          </ClickableRow>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDate<T extends { date: Date }>(rows: T[]): { dateKey: string; label: string; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
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
