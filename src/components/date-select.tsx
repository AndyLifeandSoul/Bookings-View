"use client";

import { useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Day, month and year dropdowns that submit one "YYYY-MM-DD" value under
 * `name` via a hidden input, or "" until all three are picked. The single
 * field is what the booking type actions already read, so they are
 * unchanged. Same reason as TimeSelect for avoiding the native date input:
 * Safari can show a date that isn't actually in the field.
 *
 * Holds its own part-picked state, so give it a stable React key when it
 * sits in a list that can be reordered or shortened.
 */
export function DateSelect({
  name,
  defaultValue,
  onChange,
  label,
}: {
  name: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  label: string;
}) {
  const [y0 = "", m0 = "", d0 = ""] = (defaultValue ?? "").split("-");
  const [parts, setParts] = useState({ y: y0, m: m0, d: d0 });

  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(String);
  if (parts.y && !years.includes(parts.y)) years.unshift(parts.y);

  const composed = parts.y && parts.m && parts.d ? `${parts.y}-${parts.m}-${parts.d}` : "";

  function set(patch: Partial<typeof parts>) {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange?.(next.y && next.m && next.d ? `${next.y}-${next.m}-${next.d}` : "");
  }

  const selectClass = "rounded-md border border-zinc-300 bg-white px-1.5 py-1.5 text-sm text-zinc-900";

  return (
    <span className="inline-flex items-center gap-1">
      <select aria-label={`${label}, day`} value={parts.d} onChange={(e) => set({ d: e.target.value })} className={selectClass}>
        <option value="">Day</option>
        {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
          <option key={d} value={d}>
            {Number(d)}
          </option>
        ))}
      </select>
      <select aria-label={`${label}, month`} value={parts.m} onChange={(e) => set({ m: e.target.value })} className={selectClass}>
        <option value="">Month</option>
        {MONTHS.map((label, i) => {
          const v = String(i + 1).padStart(2, "0");
          return (
            <option key={v} value={v}>
              {label}
            </option>
          );
        })}
      </select>
      <select aria-label={`${label}, year`} value={parts.y} onChange={(e) => set({ y: e.target.value })} className={selectClass}>
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <input type="hidden" name={name} value={composed} />
    </span>
  );
}
