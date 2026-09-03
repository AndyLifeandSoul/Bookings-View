import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { BookingTypeFields } from "../booking-type-fields";
import { createBookingType } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBookingTypePage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-zinc-900">New booking type</h2>
      <ActionForm action={createBookingType}>
        <input type="hidden" name="venueId" value={venue.id} />
        <BookingTypeFields submitLabel="Create booking type" />
      </ActionForm>
    </div>
  );
}
