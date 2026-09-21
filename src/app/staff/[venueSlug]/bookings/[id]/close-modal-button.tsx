"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Closes the booking overlay and goes back to the diary underneath, used
 * only in mode="modal" (see booking-details-content.tsx). router.back()
 * rather than a Link to the diary: it returns to whatever the diary was
 * showing (same date, same scroll position) instead of resetting it,
 * since the diary never actually unmounted while the overlay was open.
 */
export function CloseModalButton({ venueSlug, dateStr }: { venueSlug: string; dateStr: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-[var(--accent)]"
      aria-label={`Close, back to ${venueSlug} diary ${dateStr}`}
    >
      <X className="h-4 w-4" strokeWidth={2.25} />
      Close
    </button>
  );
}
