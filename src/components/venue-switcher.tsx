"use client";

import { useRouter, usePathname } from "next/navigation";
import type { VenueOption } from "@/lib/venues/list-active-venues";

/**
 * Jumps to the same section under a different venue, staying in whichever
 * app (staff or admin) it was used from — this is rendered both in the
 * admin layout and on the staff dashboard, for the OWNER/MANAGER sessions
 * that can see every venue, and switching venue must not silently jump a
 * staff-diary session into the admin pages (or vice versa). Root
 * ("staff"/"admin") and section come straight from the current path, so
 * this needs no per-page configuration to know which one it's in.
 *
 * Deliberately doesn't try to preserve a deeper path like an edit page's
 * id — /admin/dv8/booking-types/abc123 or /staff/dv8/bookings/abc123
 * switched to another venue would 404 on an id that belongs to dv8, not the
 * new venue — so a venue switch always lands on that section's list page.
 */
export function VenueSwitcher({
  venues,
  currentSlug,
  variant = "light",
}: {
  venues: VenueOption[];
  currentSlug: string;
  /** "dark" for use inside TopBar (staff app's dark top nav); "light" (default) for the venue-settings sub-nav, which sits on the page's white/zinc-50 background. */
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (venues.length <= 1) return null;

  function handleChange(nextSlug: string) {
    if (nextSlug === currentSlug) return;
    const segments = pathname.split("/"); // ["", root, venueSlug, section?, ...]
    const root = segments[1] || "admin";
    const section = segments[3];
    router.push(section ? `/${root}/${nextSlug}/${section}` : `/${root}/${nextSlug}`);
  }

  return (
    <select
      value={currentSlug}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Switch venue"
      className={
        variant === "dark"
          ? "rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-700"
          : "rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-400"
      }
    >
      {venues.map((v) => (
        <option key={v.slug} value={v.slug}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
