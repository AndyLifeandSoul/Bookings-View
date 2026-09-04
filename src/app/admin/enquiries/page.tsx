import Link from "next/link";
import { Inbox, Building2 } from "lucide-react";
import { getOpenEnquiries, type OpenEnquiry } from "@/lib/admin/get-open-enquiries";
import { Card } from "@/components/ui/card";
import { ClickableRow } from "@/components/clickable-row";

export const dynamic = "force-dynamic";

/**
 * Cross-venue open enquiries, every Booking.status "ENQUIRY", across every
 * venue, click through to confirm/respond/close from its booking details
 * page. Replaces the "Pending enquiries" box that used to live on Home (see
 * that page's history) now that it has a proper dedicated tab.
 *
 * Grouped into one card per venue rather than one long flat table - this is
 * a layout choice using data the table already had (venue name was just a
 * column before), not a new capability: an admin working across several
 * venues can see at a glance which ones actually need attention today
 * without a wall of repeated venue names to read past.
 */
export default async function AdminEnquiriesPage() {
  const enquiries = await getOpenEnquiries();
  const byVenue = groupByVenue(enquiries);

  return (
    <div className="animate-in mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Enquiries</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every open enquiry across every venue, {enquiries.length} waiting on a response.
        </p>
      </div>

      {enquiries.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Inbox className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No open enquiries.</p>
        </Card>
      ) : (
        <div className="animate-in-stagger mt-6 flex flex-col gap-5">
          {byVenue.map(([venueName, rows]) => (
            <Card key={venueName} padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-4 py-2.5">
                <Building2 className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} />
                <h2 className="text-sm font-semibold tracking-tight text-zinc-800">{venueName}</h2>
                <span className="text-xs text-zinc-400">
                  {rows.length} {rows.length === 1 ? "enquiry" : "enquiries"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Guests</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Contact</th>
                      <th className="px-4 py-2">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((enquiry) => {
                      const href = `/staff/${enquiry.venueSlug}/bookings/${enquiry.id}`;
                      return (
                        <ClickableRow
                          key={enquiry.id}
                          href={href}
                          className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40"
                        >
                          <td className="px-4 py-3 text-zinc-600">{formatDate(enquiry.date)}</td>
                          <td className="px-4 py-3 tabular-nums text-zinc-600">{enquiry.startTime}</td>
                          <td className="px-4 py-3 tabular-nums text-zinc-600">{enquiry.partySize}</td>
                          <td className="px-4 py-3 text-zinc-600">{enquiry.bookingTypeName}</td>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            <Link href={href} className="transition-colors hover:text-[var(--accent)] hover:underline">
                              {enquiry.customerName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            <div>{enquiry.customerEmail ?? "-"}</div>
                            {enquiry.customerPhone && <div className="text-xs text-zinc-400">{enquiry.customerPhone}</div>}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{formatDate(enquiry.createdAt)}</td>
                        </ClickableRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Preserves the incoming date/time sort within each venue's group - just partitions the already-sorted list, doesn't re-sort it. */
function groupByVenue(enquiries: OpenEnquiry[]): [string, OpenEnquiry[]][] {
  const groups = new Map<string, OpenEnquiry[]>();
  for (const e of enquiries) {
    const list = groups.get(e.venueName);
    if (list) list.push(e);
    else groups.set(e.venueName, [e]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
