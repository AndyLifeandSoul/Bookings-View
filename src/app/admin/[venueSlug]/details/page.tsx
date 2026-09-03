import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Section } from "@/components/ui/card";
import { updateVenueDetails } from "./actions";

export const dynamic = "force-dynamic";

export default async function VenueDetailsPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue: venueRef } = await requireAdminVenue(venueSlug);

  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: venueRef.id },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      bookingCode: true,
      maxArrivalsPer30Min: true,
    },
  });

  return (
    <Section
      title="Venue details"
      description="Real-world contact details for this venue — also what's shown as the sending address on booking confirmation emails once that's connected (see Messages)."
    >
      <ActionForm action={updateVenueDetails} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <input type="hidden" name="venueId" value={venue.id} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={venue.name}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Address (optional)</span>
          <textarea
            name="address"
            rows={2}
            defaultValue={venue.address ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Phone (optional)</span>
            <input
              type="tel"
              name="phone"
              defaultValue={venue.phone ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Email (optional)</span>
            <input
              type="email"
              name="email"
              defaultValue={venue.email ?? ""}
              placeholder="bookings@venuename.co.uk"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
            <span className="text-xs text-zinc-500">
              This is the mailbox confirmation emails will send from and replies will land in, once email is
              connected (Microsoft 365) — see the Messages tab.
            </span>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Booking reference code (optional)</span>
          <input
            type="text"
            name="bookingCode"
            defaultValue={venue.bookingCode ?? ""}
            placeholder="DV8"
            className="w-40 rounded-md border border-zinc-300 px-3 py-2 uppercase"
          />
          <span className="text-xs text-zinc-500">
            2-8 letters/numbers, e.g. &quot;DV8&quot;. Shown at the start of every confirmation number this venue
            issues. Changing it only affects new bookings — existing references don&apos;t change.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Max arrivals in any 30-minute period (optional)</span>
          <input
            type="number"
            name="maxArrivalsPer30Min"
            min={1}
            defaultValue={venue.maxArrivalsPer30Min ?? ""}
            placeholder="e.g. 20"
            className="w-32 rounded-md border border-zinc-300 px-3 py-2"
          />
          <span className="text-xs text-zinc-500">
            Once confirmed arrivals within any 30-minute window would exceed this many guests, a further booking
            still comes through — just as an enquiry for staff to confirm manually, regardless of its own party
            size. Leave blank for no cap.
          </span>
        </label>

        <div>
          <SubmitButton
            label="Save details"
            pendingLabel="Saving…"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          />
        </div>
      </ActionForm>
    </Section>
  );
}
