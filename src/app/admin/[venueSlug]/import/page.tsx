import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ImportFlow } from "./import-flow";

export const dynamic = "force-dynamic";

export default async function ImportBookingsPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Import bookings</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Bring {venue.name}&apos;s upcoming bookings across from another booking system. Export them as a CSV file (a Collins / DesignMyNight export works as it is), check the preview, then import. Guests aren&apos;t emailed, past and cancelled bookings are left out, and importing the same file again won&apos;t create duplicates.
        </p>
      </div>
      <ImportFlow venueSlug={venue.slug} />
    </div>
  );
}
