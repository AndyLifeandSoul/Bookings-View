import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { ActionForm } from "@/components/action-form";
import { BookingTypeFields } from "../booking-type-fields";
import { updateBookingType } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditBookingTypePage({ params }: PageProps<"/admin/booking-types/[id]">) {
  const { id } = await params;
  const session = await requireAdminSession();

  const bookingType = await prisma.bookingType.findFirst({ where: { id, venueId: session.venueId } });
  if (!bookingType) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-zinc-900">Edit {bookingType.name}</h2>
      <ActionForm action={updateBookingType}>
        <BookingTypeFields defaults={bookingType} submitLabel="Save changes" />
      </ActionForm>
    </div>
  );
}
