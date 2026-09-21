import { BookingDetailsBody } from "./booking-details-content";

export const dynamic = "force-dynamic";

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:py-12">
      <div className="animate-in mx-auto w-full max-w-3xl">
        <BookingDetailsBody venueSlug={venueSlug} id={id} mode="page" />
      </div>
    </div>
  );
}
