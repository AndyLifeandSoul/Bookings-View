"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

/**
 * Diary toolbar button that re-fetches this page's server data (new
 * bookings, check-ins, table moves made from another device) without a full
 * browser reload. The page is already `force-dynamic` and server-rendered,
 * so router.refresh() re-runs the page's data fetch against the current URL
 * and swaps in the result, the same mechanism ActionForm already relies on
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
      className={buttonStyles("secondary", "sm")}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} strokeWidth={2.25} />
      {isPending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
