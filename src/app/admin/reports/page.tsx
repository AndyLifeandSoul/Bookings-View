import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { summarise, type Count } from "@/lib/reports/summarise";
import { occasionLabel } from "@/lib/bookings/occasions";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "next30", label: "Next 30 days" },
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function fmt(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
function pounds(p: number): string {
  return `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** First and last day (inclusive) of the chosen period, by booking date. */
function periodRange(key: string, now = new Date()): { from: Date; to: Date } {
  const today = utcDay(now);
  switch (key) {
    case "7":
      return { from: addDays(today, -6), to: today };
    case "90":
      return { from: addDays(today, -89), to: today };
    case "month":
      return { from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)) };
    case "lastmonth":
      return { from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)), to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)) };
    case "next30":
      return { from: today, to: addDays(today, 29) };
    default:
      return { from: addDays(today, -29), to: today };
  }
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-zinc-900">{value}</span>
      {note && <span className="text-xs text-zinc-500">{note}</span>}
    </Card>
  );
}

function Bars({ title, rows, unit, extraUnit, format }: { title: string; rows: Count[]; unit: string; extraUnit?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      {rows.length === 0 || rows.every((r) => r.value === 0) ? (
        <p className="mt-3 text-sm text-zinc-500">Nothing in this period.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span className="truncate text-zinc-700">{r.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
              <span className="whitespace-nowrap text-right tabular-nums text-zinc-900">
                {r.value} {r.value === 1 ? unit.replace(/s$/, "") : unit}
                {r.extra != null && extraUnit && (
                  <span className="text-zinc-500">
                    {" "}
                    · {format ? format(r.extra) : r.extra} {r.extra === 1 ? extraUnit.replace(/s$/, "") : extraUnit}
                  </span>
                )}
                {r.extra != null && format && !extraUnit && <span className="text-zinc-500"> · {format(r.extra)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * How the venues are doing: bookings and covers, no-shows and
 * cancellations, where bookings come from, when people come and how far
 * ahead they book, and the money taken online. Filter by venue and period
 * (by booking date; "Next 30 days" shows what's on the books).
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ venueId?: string; period?: string }> }) {
  const sp = await searchParams;
  const venues = await listActiveVenues();
  const venueId = venues.some((v) => v.id === sp.venueId) ? sp.venueId : undefined;
  const period = PERIODS.some((p) => p.key === sp.period) ? sp.period! : "30";
  const { from, to } = periodRange(period);
  const where = { ...(venueId ? { venueId } : {}), date: { gte: from, lte: to } };

  const [bookings, payments, upcoming] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: {
        date: true,
        startTime: true,
        partySize: true,
        status: true,
        source: true,
        channel: true,
        occasion: true,
        createdAt: true,
        cancelledBy: true,
        discountPence: true,
        isWalkIn: true,
        bookingType: { select: { name: true } },
        addOns: { select: { nameSnapshot: true, quantity: true, unitPricePence: true } },
      },
    }),
    prisma.payment.findMany({
      where: { ...(venueId ? { venueId } : {}), bookingDate: { gte: from, lte: to } },
      select: { status: true, purpose: true, amountInPence: true, refundedAmountInPence: true },
    }),
    period === "next30"
      ? Promise.resolve(null)
      : prisma.booking.aggregate({
          where: { ...(venueId ? { venueId } : {}), date: { gte: utcDay(new Date()), lte: addDays(utcDay(new Date()), 13) }, status: { in: ["CONFIRMED"] } },
          _sum: { partySize: true },
          _count: true,
        }),
  ]);
  const r = summarise(
    bookings.map((b) => ({ ...b, channel: b.isWalkIn ? "walk_in" : b.channel, bookingTypeName: b.bookingType.name })),
    payments,
  );
  const q = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ venueId, period, ...p }).filter(([, v]) => v) as [string, string][]).toString();
    return s ? `?${s}` : "";
  };
  const exportQs = new URLSearchParams({ ...(venueId ? { venueId } : {}), from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }).toString();

  return (
    <div className="animate-in mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Reports</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {venueId ? venues.find((v) => v.id === venueId)?.name : "All venues"}, bookings for {fmt(from)} to {fmt(to)}.
          </p>
        </div>
        <a href={`/api/admin/payments-export?${exportQs}`} className={buttonStyles("secondary", "sm")}>
          <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
          Payments CSV
        </a>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Link href={`/admin/reports${q({ venueId: undefined })}`} className={`rounded-full px-3 py-1 text-sm font-medium ${!venueId ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}>
            All venues
          </Link>
          {venues.map((v) => (
            <Link key={v.id} href={`/admin/reports${q({ venueId: v.id })}`} className={`rounded-full px-3 py-1 text-sm font-medium ${venueId === v.id ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}>
              {v.name}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/admin/reports${q({ period: p.key })}`} className={`rounded-full px-3 py-1 text-sm font-medium ${period === p.key ? "bg-[var(--accent)] text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bookings" value={String(r.bookings)} note={`${r.covers} covers, ${r.averageParty.toFixed(1)} per booking`} />
        <Stat label="No-shows" value={String(r.noShows)} note={`${pct(r.noShowRate)} of bookings`} />
        <Stat label="Cancelled" value={String(r.cancellations)} note={`${pct(r.cancellationRate)}, ${r.cancelledByGuest} by guests online`} />
        <Stat label="Booked online" value={pct(r.onlineShare)} note={`${r.enquiries} ${r.enquiries === 1 ? "enquiry" : "enquiries"} still open`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Taken online" value={pounds(r.money.taken)} note={`${pounds(r.money.refunded)} refunded`} />
        <Stat label="Net" value={pounds(r.money.net)} note="Deposits, prepaid menus, extras and fees" />
        <Stat label="Extras sold" value={pounds(r.money.extras)} note={r.money.noShowFees ? `${pounds(r.money.noShowFees)} in no-show fees` : undefined} />
        {upcoming ? (
          <Stat label="Next 14 days" value={`${upcoming._sum.partySize ?? 0} covers`} note={`${upcoming._count} confirmed bookings`} />
        ) : (
          <Stat label="Offer discounts" value={pounds(r.money.discounts)} />
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Bars title="Where bookings came from" rows={r.bySource} unit="bookings" extraUnit="covers" />
        <Bars title="Booking types" rows={r.byType} unit="bookings" extraUnit="covers" />
        <Bars title="Covers by day" rows={r.byWeekday} unit="covers" />
        <Bars title="Covers by arrival time" rows={r.byHour} unit="covers" />
        <Bars title="How far ahead people book" rows={r.leadTime} unit="bookings" />
        <Bars title="Occasions" rows={r.occasions.map((o) => ({ ...o, label: occasionLabel(o.label) ?? o.label }))} unit="bookings" />
        {r.extras.length > 0 && <Bars title="Extras" rows={r.extras} unit="sold" extraUnit="" format={pounds} />}
      </div>
    </div>
  );
}
