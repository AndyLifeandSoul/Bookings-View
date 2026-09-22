import { ModalOverlay } from "@/components/modal-overlay";
import { NewBookingBody } from "@/app/staff/[venueSlug]/bookings/new/new-booking-content";

export const dynamic = "force-dynamic";

/**
 * Intercepts client-side navigation to /staff/[venueSlug]/bookings/new
 * (the diary's "Add booking" button) and renders it as an overlay over the
 * diary, matching DMN's Add-booking drawer and the booking-details overlay
 * next to it.
 *
 * This static "new" segment also fixes a real bug: without it, the sibling
 * (.)bookings/[id] interceptor greedily matched /bookings/new (binding
 * "new" as the [id]), so clicking Add booking tried to open a booking
 * overlay for a booking whose id was literally "new", found nothing and
 * 404'd on the client, while a refresh (which never intercepts) rendered
 * the real page. A static segment takes precedence over the dynamic [id],
 * so /bookings/new now resolves here instead. A hard load or refresh still
 * renders the full ./page.tsx, never this overlay.
 */
export default async function InterceptedNewBookingModal({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { venueSlug } = await params;
  const { date } = await searchParams;

  return (
    <ModalOverlay>
      <NewBookingBody venueSlug={venueSlug} defaultDate={date} mode="modal" />
    </ModalOverlay>
  );
}
