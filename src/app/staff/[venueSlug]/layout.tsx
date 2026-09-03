import Link from "next/link";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { getUnreadMessageCount } from "@/lib/staff/get-unread-message-count";
import { getPendingEnquiryCount } from "@/lib/staff/get-pending-enquiry-count";
import { TopBar } from "@/components/top-bar";
import { VenueSwitcher } from "@/components/venue-switcher";

export const dynamic = "force-dynamic";

/**
 * Top-level chrome for the whole /staff/[venueSlug] app — Diary / Enquiries
 * / Messages / Sign out, per Andy's nav spec. Deliberately no "List view"
 * tab here — that stays a secondary link off the Diary page (see its
 * page.tsx), not a top-level tab, per "List view should only be used as an
 * option for staff".
 *
 * Unlike /admin's top-level layout, this one IS venue-scoped (every route
 * under here has a venueSlug), so the venue switcher lives in this bar —
 * for OWNER/MANAGER sessions only, same reasoning as everywhere else it's
 * used (a STAFF session only has the one venue it's tied to).
 */
export default async function StaffVenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { session, venue } = await requireStaffVenue(venueSlug);

  const [venues, unreadCount, enquiryCount] = await Promise.all([
    session.role === "STAFF" ? Promise.resolve([]) : listActiveVenues(),
    getUnreadMessageCount(venue.id),
    getPendingEnquiryCount(venue.id),
  ]);

  return (
    <>
      <TopBar
        navItems={[
          { href: `/staff/${venue.slug}/diary`, label: "Diary", fallback: true },
          {
            href: `/staff/${venue.slug}/enquiries`,
            label: enquiryCount > 0 ? `Enquiries (${enquiryCount})` : "Enquiries",
          },
          {
            href: `/staff/${venue.slug}/messages`,
            label: unreadCount > 0 ? `Messages (${unreadCount})` : "Messages",
          },
        ]}
        userName={session.name}
        userRole={session.role}
        rightExtra={
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-zinc-200 sm:inline">{venue.name}</span>
            <VenueSwitcher venues={venues} currentSlug={venue.slug} variant="dark" />
            {session.role !== "STAFF" && (
              <Link href={`/admin/${venue.slug}/details`} className="text-sm text-zinc-300 underline hover:text-white">
                Admin
              </Link>
            )}
          </div>
        }
      />
      <div className="flex-1 bg-zinc-50">{children}</div>
    </>
  );
}
