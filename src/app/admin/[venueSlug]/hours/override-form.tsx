"use client";

import { useState } from "react";
import { TimeFieldSelect } from "@/components/time-field-select";
import { DateFieldSelect } from "@/components/date-field-select";

type Kind = "closed" | "hours" | "private" | "block";

const KINDS: { value: Kind; title: string; detail: string }[] = [
  { value: "closed", title: "Closed", detail: "No bookings at all on these dates." },
  { value: "hours", title: "Different hours", detail: "Open, but at these times instead of the usual ones. Christmas Eve, bank holidays." },
  { value: "private", title: "Private hire only", detail: "Only private hire booking types can book, at these times." },
  { value: "block", title: "Block part of the day", detail: "Keep the usual hours but stop bookings between two times, for a private event." },
];

/**
 * The fields for one special date or range, asked as a single plain choice
 * and turned into the canBook/mode/times the addOverride action reads.
 */
export function OverrideFields() {
  const [kind, setKind] = useState<Kind>("closed");
  const needsTimes = kind !== "closed";

  return (
    <div className="flex flex-col gap-5">
      <input type="hidden" name="canBook" value={kind === "hours" || kind === "private" ? "on" : "off"} />
      <input type="hidden" name="mode" value={kind === "private" ? "PRIVATE_HIRE_ONLY" : "OPEN"} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">From</span>
          <DateFieldSelect name="dateFrom" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Until</span>
          <DateFieldSelect name="dateTo" />
          <span className="text-xs text-zinc-500">Leave blank for a single day.</span>
        </div>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-zinc-800">What happens</legend>
        {KINDS.map((k) => (
          <label
            key={k.value}
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 ${kind === k.value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
          >
            <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="mt-0.5 h-4 w-4" />
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-900">{k.title}</span>
              <span className="text-xs text-zinc-500">{k.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {needsTimes && (
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800">{kind === "block" ? "Blocked from" : "Opens"}</span>
            <TimeFieldSelect name="startTime" optional />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800">{kind === "block" ? "Until" : "Closes"}</span>
            <TimeFieldSelect name="endTime" optional />
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Note for staff</span>
        <input type="text" name="note" placeholder={kind === "block" ? "Smith wedding" : kind === "closed" ? "Staff Christmas party" : "Boxing Day"} className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
      </label>
    </div>
  );
}
