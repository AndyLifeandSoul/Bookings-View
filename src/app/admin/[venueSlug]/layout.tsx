import Link from "next/link";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { LogoutButton } from "@/components/logout-button";
import { VenueSwitcher } from "@/components/venue-switcher";

export const dynamic = "force-dynamic";

export default async function AdminVenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const [{ session, venue }, venues] = await Promise.all([requireAdminVenue(venueSlug), listActiveVenues()]);

  const nav = [
    { href: `/admin/${venue.slug}/hours`, label: "Opening Hours" },
    { href: `/admin/${venue.slug}/booking-types`, label: "Booking Types" },
    { href: `/admin/${venue.slug}/tables`, label: "Tables & Areas" },
    { href: `/admin/${venue.slug}/menus`, label: "Pre-order Menus" },
    { href: `/admin/${venue.slug}/marketing`, label: "Marketing" },
    ...(session.role === "OWNER" ? [{ href: `/admin/${venue.slug}/staff`, label: "Staff Accounts" }] : []),
  ];

  return (
    <>
      <div className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-900">{venue.name} — Admin</h1>
              <VenueSwitcher venues={venues} currentSlug={venue.slug} />
            </div>
            <p className="text-sm text-zinc-500">
              {session.name} · {roleLabel(session.role)}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/staff" className="text-sm text-zinc-500 underline hover:text-zinc-900">
              Staff diary
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="mx-auto mt-4 flex max-w-4xl gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </div>
    </>
  );
}

function roleLabel(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
