import Link from "next/link";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { VenueSwitcher } from "@/components/venue-switcher";
import { PillNav } from "@/components/pill-nav";

export const dynamic = "force-dynamic";

export default async function AdminVenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const [{ venue }, venues] = await Promise.all([requireAdminVenue(venueSlug), listActiveVenues()]);

  // Staff Accounts deliberately isn't here — it's not a per-venue concept
  // (see /admin/staff/page.tsx's doc comment), so it's a standalone
  // top-level tab in the outer admin/layout.tsx instead of living in this
  // venue-scoped sub-nav.
  const nav = [
    { href: `/admin/${venue.slug}/details`, label: "Venue Details" },
    { href: `/admin/${venue.slug}/hours`, label: "Opening Hours" },
    { href: `/admin/${venue.slug}/booking-types`, label: "Booking Types" },
    { href: `/admin/${venue.slug}/tables`, label: "Tables & Areas" },
    { href: `/admin/${venue.slug}/menus`, label: "Pre-order Menus" },
    { href: `/admin/${venue.slug}/marketing`, label: "Marketing" },
  ];

  return (
    <>
      <div className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/admin/settings" className="text-sm text-zinc-400 hover:text-zinc-700">
              Settings
            </Link>
            <span className="text-sm text-zinc-300">/</span>
            <h1 className="text-lg font-semibold text-zinc-900">{venue.name}</h1>
          </div>
          <VenueSwitcher venues={venues} currentSlug={venue.slug} />
        </div>
        <div className="mx-auto mt-4 max-w-4xl">
          <PillNav items={nav} />
        </div>
      </div>
      <div className="flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </div>
    </>
  );
}
