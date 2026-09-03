import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { BookingTypeFields } from "../booking-type-fields";
import { updateBookingType } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditBookingTypePage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [bookingType, areas] = await Promise.all([
    prisma.bookingType.findFirst({
      where: { id, venueId: venue.id },
      include: { availableDates: true, areaPriorities: true },
    }),
    prisma.area.findMany({ where: { venueId: venue.id }, orderBy: { priority: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!bookingType) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-zinc-900">Edit {bookingType.name}</h2>
      <ActionForm action={updateBookingType}>
        <input type="hidden" name="venueId" value={venue.id} />
        <BookingTypeFields defaults={bookingType} areas={areas} submitLabel="Save changes" />
      </ActionForm>
    </div>
  );
}
