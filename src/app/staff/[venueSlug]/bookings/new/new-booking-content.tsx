import { CalendarPlus } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { Card } from "@/components/ui/card";
import { NewBookingForm } from "./new-booking-form";
import { naturalSortTables } from "@/lib/tables/natural-sort";
import { CloseModalButton } from "../[id]/close-modal-button";

/**
 * Shared body of the Add-booking view, rendered either as the standalone
 * page (mode "page", see ./page.tsx) or inside the diary's intercepted
 * overlay (mode "modal", see @modal/(.)bookings/new/page.tsx) - one
 * component so the two never drift apart, exactly like BookingDetailsBody.
 * The overlay is why "Add booking" opens as a drawer over the diary
 * (matching DMN) rather than navigating away.
 */

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function NewBookingBody({
  venueSlug,
  defaultDate,
  mode = "page",
}: {
  venueSlug: string;
  defaultDate?: string;
  /** "page": standalone page. "modal": rendered inside the diary overlay, adds a close button. */
  mode?: "page" | "modal";
}) {
  const { venue } = await requireStaffVenue(venueSlug);
  const date = defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate) ? defaultDate : todayStr();

  const [bookingTypes, tablesRaw] = await Promise.all([
    prisma.bookingType.findMany({ where: { venueId: venue.id, active: true }, orderBy: { sortOrder: "asc" } }),
    // No orderBy, see naturalSortTables' doc comment.
    prisma.table.findMany({ where: { venueId: venue.id, active: true } }),
  ]);
  const tables = naturalSortTables(tablesRaw);

  return (
    <>
      {mode === "modal" && <CloseModalButton venueSlug={venue.slug} dateStr={date} />}

      <div className={`flex items-center gap-2.5 ${mode === "modal" ? "mt-3" : ""}`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-soft-text)]">
          <CalendarPlus className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Add booking</h1>
      </div>

      <Card className="mt-6">
        <NewBookingForm
          venueId={venue.id}
          venueSlug={venue.slug}
          defaultDate={date}
          bookingTypes={bookingTypes.map((t) => ({ id: t.id, name: t.name, minDurationMinutes: t.minDurationMinutes }))}
          tables={tables.map((t) => ({ id: t.id, label: t.label, minCovers: t.minCovers, maxCovers: t.maxCovers, areaId: t.areaId }))}
        />
      </Card>
    </>
  );
}
