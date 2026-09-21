"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Side-panel overlay shell for the intercepted booking-details route (see
 * @modal/(.)bookings/[id]/page.tsx in the staff diary), matching
 * DesignMyNight's drawer-over-the-grid pattern from the parity review
 * (section 2/14): the diary stays mounted and visible behind it, this
 * only ever wraps content reached from within the app - a direct link or
 * a refresh renders the real page instead (see ./page.tsx), never this
 * shell, so there's always a real URL for the content even though it
 * usually appears as an overlay.
 *
 * Escape and a click on the backdrop both close it via router.back(),
 * same as the close button inside (see close-modal-button.tsx) - all
 * three are just "go back to wherever this was opened from", not a
 * dismiss-without-saving action, since every save inside the overlay is
 * already its own independent server action call.
 */
export function ModalOverlay({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-zinc-900/30" onClick={() => router.back()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-in relative flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-[var(--background)] px-4 py-8 shadow-2xl sm:px-8"
      >
        {children}
      </div>
    </div>
  );
}
