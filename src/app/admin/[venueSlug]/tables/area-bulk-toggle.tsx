"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAreaTablesActive } from "./actions";
import { buttonStyles } from "@/components/ui/button";

/**
 * "Enable all" / "Disable all" for one area's tables, sitting in that
 * area's header on the Tables page - see setAreaTablesActive's doc
 * comment for exactly what it does and doesn't touch. Each button
 * disables itself once every table in the area is already in that state,
 * so there's nothing to click that would be a no-op.
 *
 * Disabling asks for a plain confirm() first - the one bulk action here
 * that can make a whole area silently vanish from the staff diary,
 * including for any booking already taken on one of those tables for a
 * date after they'd normally go back live (the booking itself is
 * untouched, it just stops showing on the grid until the area's
 * re-enabled), so a one-click "oops" is worth one extra click to guard
 * against. Enabling has no such downside, so it applies immediately.
 *
 * Not built on ActionForm: two independent buttons in one row, each
 * needing its own pending state and one needing a confirm gate first, is
 * simpler as direct calls than two overlapping forms.
 */
export function AreaBulkToggle({
  venueId,
  areaId,
  areaName,
  hasActive,
  hasInactive,
}: {
  venueId: string;
  areaId: string;
  areaName: string;
  hasActive: boolean;
  hasInactive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(active: boolean) {
    if (!active) {
      const ok = window.confirm(
        `Disable every table in "${areaName}"? They'll stop being offered for new bookings and drop off the diary until you enable the area again.`,
      );
      if (!ok) return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("venueId", venueId);
    fd.set("areaId", areaId);
    fd.set("active", active ? "true" : "false");
    startTransition(async () => {
      const result = await setAreaTablesActive(fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {error && <span className="text-xs text-[var(--danger-soft-text)]">{error}</span>}
      <button
        type="button"
        disabled={isPending || !hasInactive}
        onClick={() => run(true)}
        className={buttonStyles("secondary", "sm")}
      >
        Enable all
      </button>
      <button
        type="button"
        disabled={isPending || !hasActive}
        onClick={() => run(false)}
        className={buttonStyles("secondary", "sm")}
      >
        Disable all
      </button>
    </div>
  );
}
