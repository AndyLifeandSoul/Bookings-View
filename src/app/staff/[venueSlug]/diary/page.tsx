import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { getDayWindow } from "@/lib/staff/get-day-window";
import { DiaryGrid, type DiaryBooking, type DiaryTable } from "./diary-grid";
import { AddWalkInButton } from "./add-walk-in-button";

export const dynamic = "force-dynamic";

export default async function DiaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { venueSlug } = await params;
  const { date: dateParam } = await searchParams;
  const { venue } = await requireStaffVenue(venueSlug);

  const dateStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr();
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const prevDate = addDays(dateStr, -1);
  const nextDate = addDays(dateStr, 1);

  const [tables, bookingRows, bookingTypes, window] = await Promise.all([
    prisma.table.findMany({
      where: { venueId: venue.id, active: true },
      orderBy: [{ area: { priority: "asc" } }, { sortOrder: "asc" }, { label: "asc" }],
      include: { area: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { venueId: venue.id, date, status: { not: "CANCELLED" } },
      include: { bookingType: { select: { name: true, color: true } }, bookingTables: { select: { tableId: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.bookingType.findMany({
      where: { venueId: venue.id, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getDayWindow(venue.id, date),
  ]);

  const diaryTables: DiaryTable[] = tables.map((t) => ({ id: t.id, label: t.label, areaName: t.area?.name ?? null }));
  const diaryBookings: DiaryBooking[] = bookingRows.map((b) => ({
    id: b.id,
    customerName: b.customerName,
    partySize: b.partySize,
    status: b.status,
    startTime: b.startTime,
    endTime: b.endTime,
    bookingTypeName: b.bookingType.name,
    bookingTypeColor: b.bookingType.color,
    tableIds: b.bookingTables.map((bt) => bt.tableId),
    checkedInAt: b.checkedInAt ? b.checkedInAt.toISOString() : null,
    checkedOutAt: b.checkedOutAt ? b.checkedOutAt.toISOString() : null,
  }));

  // A day with no weekly hours and no exception is "closed" per getDayWindow
  // — but if there happen to be real bookings on it anyway (a manually
  // entered phone booking on an otherwise-closed day, say), show a window
  // wide enough to cover them rather than hiding real data.
  const effectiveWindow = window.closed && diaryBookings.length > 0 ? widenToFit(diaryBookings) : window;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{venue.name} — Table diary</h1>
            <p className="text-sm text-zinc-500">Drag a booking onto a different table to reseat it.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/staff/${venue.slug}/bookings/new?date=${dateStr}`}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Add booking
            </Link>
            <AddWalkInButton
              venueId={venue.id}
              venueSlug={venue.slug}
              dateStr={dateStr}
              tables={diaryTables.map((t) => ({ id: t.id, label: t.label }))}
              bookingTypes={bookingTypes}
            />
            <Link
              href={`/staff/${venue.slug}/enquiries/new?date=${dateStr}`}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Add enquiry
            </Link>
            <Link href={`/staff/${venue.slug}/list`} className="text-sm text-zinc-500 underline hover:text-zinc-900">
              List view
            </Link>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Link
            href={`/staff/${venue.slug}/diary?date=${prevDate}`}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100"
          >
            ← Prev
          </Link>
          <span className="text-sm font-medium text-zinc-900">{formatDate(date)}</span>
          <Link
            href={`/staff/${venue.slug}/diary?date=${nextDate}`}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100"
          >
            Next →
          </Link>
        </div>

        <div className="mt-6">
          {tables.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
              No tables set up for this venue yet — see Tables &amp; Areas in Admin.
            </p>
          ) : effectiveWindow.closed ? (
            <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
              {venue.name} is closed on {formatDate(date)}.
            </p>
          ) : (
            <DiaryGrid
              venueId={venue.id}
              venueSlug={venue.slug}
              tables={diaryTables}
              bookings={diaryBookings}
              startMinutes={effectiveWindow.startMinutes}
              endMinutes={effectiveWindow.endMinutes}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function widenToFit(bookings: DiaryBooking[]): { closed: boolean; startMinutes: number; endMinutes: number } {
  let min = 24 * 60;
  let max = 0;
  for (const b of bookings) {
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    min = Math.min(min, sh * 60 + sm);
    max = Math.max(max, eh * 60 + em);
  }
  return { closed: false, startMinutes: Math.max(min - 30, 0), endMinutes: max + 30 };
}
