import { CalendarCheck2, Users2, TrendingUp, Store } from "lucide-react";
import { getDashboardStats } from "@/lib/admin/get-dashboard-stats";
import { StatCard } from "@/components/ui/stat-card";
import { Section, Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** The admin app's default landing page (Home). Cross-venue stats, see get-dashboard-stats.ts for the exact "today"/"this week" definitions and why covers-per-type merges same-named types across venues. */
export default async function AdminHomePage() {
  const stats = await getDashboardStats();

  return (
    // The top-level /admin layout (unlike the venue-scoped [venueSlug]
    // layout, which wraps its children in this same px/py/max-w shell)
    // applies no padding of its own, every direct child of /admin supplies
    // it (see customers/page.tsx for the same pattern). This page was
    // missing it, so its content sat flush against the browser edge.
    <div className="animate-in mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col gap-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Home</h1>
        </div>

        <Section title="Today &amp; this week">
          <div className="animate-in-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bookings today" value={stats.bookingsToday} icon={CalendarCheck2} tone="accent" />
            <StatCard label="Covers today" value={stats.coversToday} icon={Users2} tone="violet" />
            <StatCard
              label={`Bookings this week (${stats.weekLabel})`}
              value={stats.bookingsThisWeek}
              icon={TrendingUp}
              tone="success"
            />
            <StatCard
              label={`Covers this week (${stats.weekLabel})`}
              value={stats.coversThisWeek}
              icon={Users2}
              tone="info"
            />
          </div>
        </Section>

        <Section title="Covers per booking type" description={`This week (${stats.weekLabel}), across every venue.`}>
          {stats.coversByType.length === 0 ? (
            <EmptyState message="No bookings this week yet." />
          ) : (
            <StatsTable
              rows={stats.coversByType}
              firstColumnLabel="Booking type"
              getKey={(row) => row.bookingTypeName}
              getLabel={(row) => row.bookingTypeName}
            />
          )}
        </Section>

        <Section title="Bookings by venue" description={`This week (${stats.weekLabel}).`}>
          {stats.coversByVenue.length === 0 ? (
            <EmptyState message="No bookings this week yet." icon={Store} />
          ) : (
            <StatsTable
              rows={stats.coversByVenue}
              firstColumnLabel="Venue"
              getKey={(row) => row.venueName}
              getLabel={(row) => row.venueName}
            />
          )}
        </Section>
      </div>
    </div>
  );
}

function EmptyState({ message, icon: Icon = CalendarCheck2 }: { message: string; icon?: typeof CalendarCheck2 }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="text-sm text-zinc-500">{message}</p>
    </Card>
  );
}

/** Shared "name, bookings, covers" table shape used by both the per-type and per-venue breakdowns below, rows already sorted by covers descending by get-dashboard-stats.ts. */
function StatsTable<T>({
  rows,
  firstColumnLabel,
  getKey,
  getLabel,
}: {
  rows: (T & { bookings: number; covers: number })[];
  firstColumnLabel: string;
  getKey: (row: T) => string;
  getLabel: (row: T) => string;
}) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">{firstColumnLabel}</th>
              <th className="px-4 py-2.5">Bookings</th>
              <th className="px-4 py-2.5">Covers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getKey(row)} className="group border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/80">
                <td className="px-4 py-3 font-medium text-zinc-900">{getLabel(row)}</td>
                <td className="px-4 py-3 tabular-nums text-zinc-700">{row.bookings}</td>
                <td className="px-4 py-3 tabular-nums text-zinc-700">{row.covers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
