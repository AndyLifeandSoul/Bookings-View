"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGuestListEntry } from "./actions";

/** Big tap targets for the door: one more in, one back out, everyone in, no-show. */
export function DoorButtons({ id, venueId, arrived, guests, status }: { id: string; venueId: string; arrived: number; guests: number; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (op: string) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("venueId", venueId);
    fd.set("op", op);
    start(async () => {
      await updateGuestListEntry(fd);
      router.refresh();
    });
  };
  const btn = "rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50";
  if (status === "CANCELLED" || status === "NO_SHOW") {
    return (
      <button type="button" disabled={pending} onClick={() => run("restore")} className={`${btn} border border-zinc-300 text-zinc-700`}>
        Put back
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={pending || arrived === 0} onClick={() => run("out")} aria-label="One less" className={`${btn} border border-zinc-300 text-zinc-700`}>
        -1
      </button>
      <span className="min-w-[3.5rem] text-center text-base font-semibold tabular-nums text-zinc-900">
        {arrived}/{guests}
      </span>
      <button type="button" disabled={pending} onClick={() => run("in")} aria-label="One more in" className={`${btn} bg-[var(--accent)] text-white`}>
        +1
      </button>
      {arrived < guests && (
        <button type="button" disabled={pending} onClick={() => run("all")} className={`${btn} border border-[var(--accent)] text-[var(--accent)]`}>
          All in
        </button>
      )}
      {arrived === 0 && (
        <button type="button" disabled={pending} onClick={() => run("noshow")} className={`${btn} text-zinc-500 hover:text-zinc-800`}>
          No-show
        </button>
      )}
      <button type="button" disabled={pending} onClick={() => run("cancel")} className={`${btn} text-zinc-400 hover:text-red-700`}>
        Remove
      </button>
    </div>
  );
}
