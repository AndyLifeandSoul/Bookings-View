import Link from "next/link";
import { getDashboardStats } from "@/lib/admin/get-dashboard-stats";
import { StatCard } from "@/components/ui/stat-card";
import { Section } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** The admin app's default landing page (Home). Cross-venue stats — see get-dashboard-stats.ts for the exact "today"/"this week" definitions and why covers-per-type merges same-named types across venues. */
export default async function AdminHomePage() {
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Home</h1>
        <p className="mt-1 text-sm text-zinc-500">Across every venue.</p>
      </div>

      <Section title="Today &amp; this week">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Bookings today" value={stats.bookingsToday} />
          <StatCard label="Covers today" value={stats.coversToday} />
          <StatCard label={`Bookings this week (${stats.weekLabel})`} value={stats.bookingsThisWeek} />
          <StatCard label={`Covers this week (${stats.weekLabel})`} value={stats.coversThisWeek} />
        </div>
      </Section>

      <Section title="Covers per booking type" description={`This week (${stats.weekLabel}), across every venue.`}>
        {stats.coversByType.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
            No bookings this week yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Booking type</th>
                  <th className="px-4 py-2">Bookings</th>
                  <th className="px-4 py-2">Covers</th>
                </tr>
              </thead>
              <tbody>
                {stats.coversByType.map((row) => (
                  <tr key={row.bookingTypeName} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-900">{row.bookingTypeName}</td>
                    <td className="px-4 py-2.5">{row.bookings}</td>
                    <td className="px-4 py-2.5">{row.covers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Pending enquiries"
        description="Across every venue — click one to open its booking details and confirm, respond, or close it."
      >
        {stats.pendingEnquiries.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
            No pending enquiries.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
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
                {stats.pendingEnquiries.map((enquiry) => (
                  <tr key={enquiry.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/staff/${enquiry.venueSlug}/bookings/${enquiry.id}`} className="hover:underline">
                        {enquiry.venueName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600">{formatDate(enquiry.date)}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{enquiry.startTime}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{enquiry.partySize}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{enquiry.bookingTypeName}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-900">
                      <Link href={`/staff/${enquiry.venueSlug}/bookings/${enquiry.id}`} className="hover:underline">
                        {enquiry.customerName}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
