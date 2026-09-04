"use client";

import { useRouter } from "next/navigation";

/**
 * The diary's date label, made clickable — Prev/Next only move one day at
 * a time, so jumping several weeks out meant repeated clicking. This
 * overlays a native <input type="date"> on top of the visible formatted
 * label (same size, invisible), so a click anywhere on the label opens the
 * browser's own date picker rather than needing a custom calendar widget.
 * Picking a date navigates straight to that day's diary.
 */
export function DateJump({ venueSlug, dateStr, label }: { venueSlug: string; dateStr: string; label: string }) {
  const router = useRouter();

  return (
    <span className="relative inline-flex">
      <span className="cursor-pointer text-sm font-medium text-zinc-900 underline decoration-dotted decoration-zinc-400 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]">
        {label}
      </span>
      <input
        type="date"
        value={dateStr}
        onChange={(e) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
            router.push(`/staff/${venueSlug}/diary?date=${e.target.value}`);
          }
        }}
        aria-label="Jump to a date"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
