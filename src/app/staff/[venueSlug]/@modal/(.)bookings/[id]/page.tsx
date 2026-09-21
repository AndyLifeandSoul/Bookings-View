import { ModalOverlay } from "@/components/modal-overlay";
import { BookingDetailsBody } from "@/app/staff/[venueSlug]/bookings/[id]/booking-details-content";

export const dynamic = "force-dynamic";

/**
 * Intercepts client-side navigation to /staff/[venueSlug]/bookings/[id]
 * from anywhere else under /staff/[venueSlug] (the diary, the list
 * sidebar) and renders it as an overlay on top of whatever's already on
 * screen, instead of navigating away from it - see ModalOverlay's doc
 * comment and the parity review's section 14/15 recommendation that the
 * overlay become the single way staff open a booking, not a second
 * layout alongside the full page. A hard load or refresh of this same
 * URL never goes through this file at all (that's what "intercepting"
 * means): Next resolves ../../bookings/[id]/page.tsx instead, which
 * renders the exact same BookingDetailsBody content, just without the
 * overlay chrome - so the two are never allowed to drift into different
 * layouts, they're the same component either way.
 */
export default async function InterceptedBookingModal({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;

  return (
    <ModalOverlay>
      <BookingDetailsBody venueSlug={venueSlug} id={id} mode="modal" />
    </ModalOverlay>
  );
}
