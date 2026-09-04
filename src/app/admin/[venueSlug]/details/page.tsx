import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Section, Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
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
    <Section title="Venue details">
      <Card>
        <ActionForm action={updateVenueDetails} className="flex flex-col gap-4">
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
          </label>

          <div>
            <SubmitButton label="Save details" pendingLabel="Saving…" className={buttonStyles("primary", "md")} />
          </div>
        </ActionForm>
      </Card>
    </Section>
  );
}
