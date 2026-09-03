"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Diary toolbar button that re-fetches this page's server data (new
 * bookings, check-ins, table moves made from another device) without a full
 * browser reload. The page is already `force-dynamic` and server-rendered,
 * so router.refresh() re-runs the page's data fetch against the current URL
 * and swaps in the result — the same mechanism ActionForm already relies on
 * after a save (see its call site's doc comments elsewhere in this app).
 * Staff otherwise only see new bookings after switching dates and back, or
 * a manual browser reload.
 */
export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
    >
      {isPending ? "Refreshing…" : "↻ Refresh"}
    </button>
  );
}
