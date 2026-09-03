import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { createManualEnquiry } from "./actions";

export const dynamic = "force-dynamic";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewEnquiryPage({
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

  const bookingTypes = await prisma.bookingType.findMany({
    where: { venueId: venue.id, active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Add enquiry</h1>
      <p className="mt-1 text-sm text-zinc-500">
        For a phoned-in or in-person enquiry — every field here is required, since it&apos;s the whole record of what
        was discussed until someone follows up.
      </p>

      <ActionForm action={createManualEnquiry} className="mt-6 flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <input type="hidden" name="venueId" value={venue.id} />
        <input type="hidden" name="venueSlug" value={venue.slug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Date</span>
            <input type="date" name="date" required defaultValue={defaultDate} className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Booking type</span>
            <select name="bookingTypeId" required className="rounded-md border border-zinc-300 px-3 py-2">
              {bookingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Time</span>
            <input type="time" name="startTime" required className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Party size</span>
            <input type="number" name="partySize" min={1} required defaultValue={2} className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input type="text" name="customerName" required className="rounded-md border border-zinc-300 px-3 py-2" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input type="email" name="customerEmail" required className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Phone</span>
            <input type="tel" name="customerPhone" required className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Taken by</span>
          <input type="text" name="takenByStaffName" required placeholder="Your name" className="rounded-md border border-zinc-300 px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Notes</span>
          <textarea name="notes" required rows={3} placeholder="What was discussed" className="rounded-md border border-zinc-300 px-3 py-2" />
        </label>

        <div>
          <SubmitButton
            label="Add enquiry"
            pendingLabel="Adding…"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          />
        </div>
      </ActionForm>
    </div>
  );
}
