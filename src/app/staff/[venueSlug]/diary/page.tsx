import Link from "next/link";
import { Plus, MessageCirclePlus, ArrowLeft, ArrowRight, List, CalendarOff, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { getDayWindow } from "@/lib/staff/get-day-window";
import { DiaryGrid, type DiaryBooking, type DiaryTable } from "./diary-grid";
import { AddWalkInButton } from "./add-walk-in-button";
import { RefreshButton } from "./refresh-button";
import { DateJump } from "./date-jump";
import { naturalSortTables } from "@/lib/tables/natural-sort";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

  const today = todayStr();
  const dateStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const prevDate = addDays(dateStr, -1);
  const nextDate = addDays(dateStr, 1);
  const isToday = dateStr === today;

  const [tables, bookingRows, bookingTypes, window] = await Promise.all([
    prisma.table.findMany({
      where: { venueId: venue.id, active: true },
      // No orderBy here - sorted below with naturalSortTables instead. See
      // that function's doc comment for why: ordering by area priority put
      // every unassigned-area table at the bottom (Postgres NULLS LAST),
      // regardless of its label.
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

  const diaryTables: DiaryTable[] = naturalSortTables(tables).map((t) => ({
    id: t.id,
    label: t.label,
    areaName: t.area?.name ?? null,
  }));
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
    notes: b.notes,
  }));

  // A day with no weekly hours and no exception is "closed" per getDayWindow,
  // but if there happen to be real bookings on it anyway (a manually
  // entered phone booking on an otherwise-closed day, say), show a window
  // wide enough to cover them rather than hiding real data.
  const effectiveWindow = window.closed && diaryBookings.length > 0 ? widenToFit(diaryBookings) : window;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:py-12">
      <div className="animate-in mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{venue.name} Table diary</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton />
            <Link href={`/staff/${venue.slug}/bookings/new?date=${dateStr}`} className={buttonStyles("primary", "sm")}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Add booking
            </Link>
            <AddWalkInButton
              venueId={venue.id}
              venueSlug={venue.slug}
              dateStr={dateStr}
              tables={diaryTables}
              bookingTypes={bookingTypes}
            />
            <Link href={`/staff/${venue.slug}/enquiries/new?date=${dateStr}`} className={buttonStyles("secondary", "sm")}>
              <MessageCirclePlus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Add enquiry
            </Link>
            <Link href={`/staff/${venue.slug}/list`} className={buttonStyles("ghost", "sm")}>
              <List className="h-3.5 w-3.5" strokeWidth={2.25} />
              List view
            </Link>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Link href={`/staff/${venue.slug}/diary?date=${prevDate}`} className={buttonStyles("secondary", "sm")}>
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            Prev
          </Link>
          <DateJump venueSlug={venue.slug} dateStr={dateStr} label={formatDate(date)} />
          <Link href={`/staff/${venue.slug}/diary?date=${nextDate}`} className={buttonStyles("secondary", "sm")}>
            Next
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </Link>
          {!isToday && (
            <Link href={`/staff/${venue.slug}/diary`} className={buttonStyles("ghost", "sm")}>
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.25} />
              Today
            </Link>
          )}
        </div>

        <div className="mt-6">
          {tables.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <CalendarOff className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="text-sm text-zinc-500">No tables set up for this venue yet. See Tables &amp; Areas in Admin.</p>
            </Card>
          ) : effectiveWindow.closed ? (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <CalendarOff className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="text-sm text-zinc-500">
                {venue.name} is closed on {formatDate(date)}.
              </p>
            </Card>
          ) : (
            <DiaryGrid
              venueId={venue.id}
              venueSlug={venue.slug}
              tables={diaryTables}
              bookings={diaryBookings}
              startMinutes={effectiveWindow.startMinutes}
              endMinutes={effectiveWindow.endMinutes}
              isToday={isToday}
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
