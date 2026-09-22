import { NewBookingBody } from "./new-booking-content";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { venueSlug } = await params;
  const { date } = await searchParams;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:py-12">
      <div className="animate-in mx-auto w-full max-w-2xl">
        <NewBookingBody venueSlug={venueSlug} defaultDate={date} mode="page" />
      </div>
    </div>
  );
}
