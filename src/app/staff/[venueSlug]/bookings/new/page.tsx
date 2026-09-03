import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { createManualBooking } from "./actions";
import { TimeFields } from "./time-fields";
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
    // No orderBy — see naturalSortTables' doc comment.
    prisma.table.findMany({ where: { venueId: venue.id, active: true } }),
  ]);
  const tables = naturalSortTables(tablesRaw);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Add booking</h1>
      <p className="mt-1 text-sm text-zinc-500">
        For a phoned-in or walk-in booking. A booking for <strong>today</strong> only needs a time, name, table and
        booking type — no contact details required. A booking for a <strong>future date</strong> needs an email or
        phone number, and who took it.
      </p>

      <ActionForm action={createManualBooking} className="mt-6 flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <input type="hidden" name="venueId" value={venue.id} />
        <input type="hidden" name="venueSlug" value={venue.slug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Date</span>
            <input type="date" name="date" required defaultValue={defaultDate} className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
          <TimeFields
            bookingTypes={bookingTypes.map((t) => ({ id: t.id, name: t.name, minDurationMinutes: t.minDurationMinutes }))}
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Party size</span>
            <input type="number" name="partySize" min={1} required defaultValue={2} className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Taken by</span>
            <input
              type="text"
              name="takenByStaffName"
              placeholder="Your name"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
            <span className="text-xs text-zinc-500">Required for a future date, since every venue shares one login.</span>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Customer name</span>
          <input type="text" name="customerName" required className="rounded-md border border-zinc-300 px-3 py-2" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input type="email" name="customerEmail" className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Phone</span>
            <input type="tel" name="customerPhone" className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
        </div>
        <p className="-mt-2 text-xs text-zinc-500">
          Not required for a same-day booking. For a future date, at least one of email or phone is required.
        </p>

        <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Table(s)</legend>
          {tables.length === 0 ? (
            <p className="text-sm text-zinc-500">No tables set up for this venue yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {tables.map((table) => (
                <label key={table.id} className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm">
                  <input type="checkbox" name="tableIds" value={table.id} className="h-4 w-4 rounded border-zinc-300" />
                  {table.label}
                </label>
              ))}
            </div>
          )}
          <span className="text-xs text-zinc-500">Required for a same-day booking; optional for a future date.</span>
        </fieldset>

        <div>
          <SubmitButton
            label="Add booking"
            pendingLabel="Adding…"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          />
        </div>
      </ActionForm>
    </div>
  );
}
