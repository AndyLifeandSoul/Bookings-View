import Link from "next/link";
import { getOpenEnquiries } from "@/lib/admin/get-open-enquiries";

export const dynamic = "force-dynamic";

/**
 * Cross-venue open enquiries — every Booking.status "ENQUIRY", across every
 * venue, click through to confirm/respond/close from its booking details
 * page. Replaces the "Pending enquiries" box that used to live on Home (see
 * that page's history) now that it has a proper dedicated tab.
 */
export default async function AdminEnquiriesPage() {
  const enquiries = await getOpenEnquiries();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Enquiries</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every open enquiry across every venue — {enquiries.length} waiting on a response.
        </p>
      </div>

      {enquiries.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No open enquiries.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Venue</th>
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
              {enquiries.map((enquiry) => (
                <tr key={enquiry.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 text-zinc-600">{enquiry.venueName}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{formatDate(enquiry.date)}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{enquiry.startTime}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{enquiry.partySize}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{enquiry.bookingTypeName}</td>
                  <td className="px-4 py-2.5 font-medium text-zinc-900">
                    <Link href={`/staff/${enquiry.venueSlug}/bookings/${enquiry.id}`} className="hover:underline">
                      {enquiry.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">
                    <div>{enquiry.customerEmail ?? "—"}</div>
                    {enquiry.customerPhone && <div className="text-xs text-zinc-400">{enquiry.customerPhone}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{formatDate(enquiry.createdAt)}</td>
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
