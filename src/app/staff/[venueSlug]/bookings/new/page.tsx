import { CalendarPlus } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { Card } from "@/components/ui/card";
import { NewBookingForm } from "./new-booking-form";
import { naturalSortTables } from "@/lib/tables/natural-sort";

export const dynamic = "force-dynamic";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { venueSlug } = await params;
  const { date: dateParam } = await searchParams;
  const { venue } = await requireStaffVenue(venueSlug);
  const defaultDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr();

  const [bookingTypes, tablesRaw] = await Promise.all([
    prisma.bookingType.findMany({ where: { venueId: venue.id, active: true }, orderBy: { sortOrder: "asc" } }),
    // No orderBy, see naturalSortTables' doc comment.
    prisma.table.findMany({ where: { venueId: venue.id, active: true } }),
  ]);
  const tables = naturalSortTables(tablesRaw);

  return (
    <div className="animate-in mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-soft-text)]">
          <CalendarPlus className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Add booking</h1>
      </div>

      <Card className="mt-6">
        <NewBookingForm
          venueId={venue.id}
          venueSlug={venue.slug}
          defaultDate={defaultDate}
          bookingTypes={bookingTypes.map((t) => ({ id: t.id, name: t.name, minDurationMinutes: t.minDurationMinutes }))}
          tables={tables.map((t) => ({ id: t.id, label: t.label, minCovers: t.minCovers, maxCovers: t.maxCovers, areaId: t.areaId }))}
        />
      </Card>
    </div>
  );
}
