import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { guestFlagsFor } from "@/lib/admin/guest-flags";
import { buttonStyles } from "@/components/ui/button";
import type { LiveState } from "@/components/floor-plan";
import { FloorLive } from "./floor-live";

export const dynamic = "force-dynamic";

function localNow(timezone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
// Minutes into the trading day: times before 6am belong to the night before.
const mins = (hhmm: string) => {
  const m = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  return m < 360 ? m + 1440 : m;
};
function prevDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Who's where right now: every table on the floor plan, coloured by
 * whether it's free, has someone due, someone late, or a group sat down,
 * with the next booking shown on free tables. Pick another time to look
 * ahead. Tapping a table opens its booking.
 */
export default async function LiveFloorPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ time?: string }>;
}) {
  const { venueSlug } = await params;
  const sp = await searchParams;
  const { venue } = await requireStaffVenue(venueSlug);
  const now = localNow(venue.timezone);
  const following = !sp.time || !/^\d{2}:\d{2}$/.test(sp.time);
  const at = following ? now.time : sp.time!;
  const atMin = mins(at);
  const tradingDate = now.time < "06:00" ? prevDay(now.date) : now.date;

  const [areas, tables, bookings] = await Promise.all([
    prisma.area.findMany({ where: { venueId: venue.id }, orderBy: { priority: "asc" }, select: { id: true, name: true } }),
    prisma.table.findMany({ where: { venueId: venue.id, active: true } }),
    prisma.booking.findMany({
      where: { venueId: venue.id, date: new Date(`${tradingDate}T00:00:00.000Z`), status: { in: ["CONFIRMED", "COMPLETED", "PENDING_PAYMENT"] } },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        partySize: true,
        startTime: true,
        endTime: true,
        checkedInAt: true,
        checkedOutAt: true,
        dietaryNotes: true,
        bookingTables: { select: { tableId: true } },
      },
    }),
  ]);
  const flags = await guestFlagsFor(bookings);

  const live: Record<string, LiveState> = {};
  for (const t of tables) {
    const mine = bookings.filter((b) => b.bookingTables.some((bt) => bt.tableId === t.id) && !b.checkedOutAt);
    const span = (b: (typeof mine)[number]) => {
      const s = mins(b.startTime);
      let e = mins(b.endTime);
      if (e <= s) e += 24 * 60;
      return { s, e };
    };
    const current = mine.find((b) => {
      const { s, e } = span(b);
      return (s <= atMin && atMin < e) || (b.checkedInAt && s <= atMin + 30);
    });
    const href = (b: { id: string }) => `/staff/${venue.slug}/bookings/${b.id}`;
    const vip = (b: { id: string }) => (flags.get(b.id)?.tags.includes("VIP") ? " ★" : "");
    if (current) {
      const { s } = span(current);
      const name = current.customerName.split(" ")[0] + vip(current);
      const allergy = current.dietaryNotes || flags.get(current.id)?.allergies ? " · allergy" : "";
      if (current.checkedInAt) {
        live[t.id] = { tone: "seated", title: name, sub: `${current.partySize} · till ${current.endTime}${allergy}`, href: href(current) };
      } else if (atMin - s > 15) {
        live[t.id] = { tone: "late", title: name, sub: `${current.partySize} · ${atMin - s}m late`, href: href(current) };
      } else {
        live[t.id] = { tone: "due", title: name, sub: `${current.partySize} at ${current.startTime}${allergy}`, href: href(current) };
      }
      continue;
    }
    const next = mine.find((b) => span(b).s > atMin);
    if (next) {
      const gap = span(next).s - atMin;
      live[t.id] =
        gap <= 60
          ? { tone: "soon", title: next.customerName.split(" ")[0] + vip(next), sub: `${next.partySize} at ${next.startTime}`, href: href(next) }
          : { tone: "free", sub: `next ${next.startTime}` };
    }
  }

  const counts = { seated: 0, due: 0, late: 0, free: 0, soon: 0 } as Record<LiveState["tone"], number>;
  for (const t of tables) counts[live[t.id]?.tone ?? "free"] += 1;
  const covers = bookings
    .filter((b) => b.checkedInAt && !b.checkedOutAt)
    .reduce((s, b) => s + b.partySize, 0);
  const planned = tables.some((t) => t.planX != null);
  const times = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

  return (
    <div className="animate-in mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Floor</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {following ? `Now, ${at}` : `Today at ${at}`}: {counts.seated} {counts.seated === 1 ? "table" : "tables"} sat ({covers} guests in), {counts.due + counts.late} still to arrive{counts.late ? ` (${counts.late} late)` : ""}, {counts.free + counts.soon} free.
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <select name="time" defaultValue={following ? "" : at} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm" aria-label="Show the floor at">
            <option value="">Now</option>
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonStyles("secondary", "sm")}>
            Show
          </button>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600">
        {[
          ["bg-emerald-100 border-emerald-500", "Sat down"],
          ["bg-amber-50 border-amber-400", "Due now"],
          ["bg-red-50 border-red-400", "Late"],
          ["bg-sky-50 border-sky-400", "Arriving within the hour"],
          ["bg-white border-zinc-300", "Free"],
        ].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded border-2 ${c}`} /> {l}
          </span>
        ))}
      </div>

      <div className="mt-4">
        {planned ? (
          <FloorLive
            tables={tables.map((t) => ({ id: t.id, label: t.label, maxCovers: t.maxCovers, areaId: t.areaId, x: t.planX, y: t.planY, w: t.planW, h: t.planH, shape: t.planShape, rotate: t.planRotate }))}
            areas={areas}
            live={live}
            following={following}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
            No floor plan yet. A manager can draw one in{" "}
            <Link href={`/admin/${venue.slug}/floor-plan`} className="font-semibold text-[var(--accent)] underline">
              Settings, Floor plan
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
