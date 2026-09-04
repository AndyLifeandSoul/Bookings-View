import Link from "next/link";
import { Plus, MessageCirclePlus, LayoutGrid } from "lucide-react";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { getUpcomingBookingsForVenue } from "@/lib/staff/get-bookings-for-venue";
import { buttonStyles } from "@/components/ui/button";
import { BookingListSearch } from "./booking-list-search";

export const dynamic = "force-dynamic";

/**
 * The list view, moved here from bare /staff/[venueSlug] (now the Diary,
 * see ../page.tsx's redirect) per Andy's "Table View should be the default,
 * List view should only be used as an option for staff": this is reached
 * only via the "List view" link on the Diary page, never a top-level tab.
 */
export default async function StaffListPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const bookings = await getUpcomingBookingsForVenue(venue.id);

  return (
    <div className="flex flex-1 flex-col px-4 py-8 sm:py-12">
      <div className="animate-in mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{venue.name}, list view</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/staff/${venue.slug}/bookings/new`} className={buttonStyles("primary", "sm")}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Add booking
            </Link>
            <Link href={`/staff/${venue.slug}/enquiries/new`} className={buttonStyles("secondary", "sm")}>
              <MessageCirclePlus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Add enquiry
            </Link>
            <Link href={`/staff/${venue.slug}/diary`} className={buttonStyles("ghost", "sm")}>
              <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.25} />
              Table view
            </Link>
          </div>
        </div>

        <BookingListSearch bookings={bookings} venueSlug={venue.slug} />
      </div>
    </div>
  );
}
