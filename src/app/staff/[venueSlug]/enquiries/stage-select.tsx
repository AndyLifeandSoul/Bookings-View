"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEnquiryStage } from "./actions";
import { ENQUIRY_STAGES as STAGES } from "@/lib/bookings/enquiry-stages";

/** Moves an enquiry card between columns without opening it. */
export function StageSelect({ id, venueId, venueSlug, stage }: { id: string; venueId: string; venueSlug: string; stage: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Stage"
      value={stage}
      disabled={pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("venueId", venueId);
        fd.set("venueSlug", venueSlug);
        fd.set("stage", e.target.value);
        start(async () => {
          await setEnquiryStage(fd);
          router.refresh();
        });
      }}
      className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-700"
    >
      {STAGES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
