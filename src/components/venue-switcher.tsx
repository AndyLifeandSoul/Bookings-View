"use client";

import { useRouter, usePathname } from "next/navigation";
import type { VenueOption } from "@/lib/venues/list-active-venues";

/**
 * Jumps to the same admin section (hours/booking-types/menus) under a
 * different venue. Deliberately doesn't try to preserve a deeper path like
 * an edit page's id — /admin/dv8/booking-types/abc123 switched to another
 * venue would 404 on an id that belongs to dv8, not the new venue — so a
 * venue switch always lands on that section's list page.
 */
export function VenueSwitcher({ venues, currentSlug }: { venues: VenueOption[]; currentSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();

  if (venues.length <= 1) return null;

  function handleChange(nextSlug: string) {
    if (nextSlug === currentSlug) return;
    const section = pathname.split("/")[3] ?? "hours";
    router.push(`/admin/${nextSlug}/${section}`);
  }

  return (
    <select
      value={currentSlug}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Switch venue"
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-700"
    >
      {venues.map((v) => (
        <option key={v.slug} value={v.slug}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
