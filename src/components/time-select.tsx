"use client";

import { useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

/**
 * Hour and minute dropdowns that submit one "HH:mm" value under `name` via a
 * hidden input, or "" when no hour is picked (meaning "not set").
 *
 * Replaces native <input type="time"> in the booking type form. Safari drops
 * typed values from the native picker: type "18", tab away, and the field is
 * left half-filled, so the browser rejects it as invalid on submit even though
 * it looks complete. Dropdowns have no half-typed state. This is the same fix
 * TimeFieldSelect applies on the opening hours page, but it keeps the single
 * "HH:mm" field the booking type server actions already read, so those actions
 * are unchanged.
 *
 * Controlled (`value` + `onChange`, for rows held in parent state) or
 * uncontrolled (`defaultValue`). `disabled` greys it out and stops it
 * submitting, the same as a disabled input.
 */
export function TimeSelect({
  name,
  value,
  defaultValue,
  onChange,
  disabled = false,
  label,
  minuteStep = 5,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  disabled?: boolean;
  /** Read out to screen readers, e.g. "Saturday first arrival". */
  label: string;
  minuteStep?: number;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const [rawHour = "", rawMinute = "00"] = current ? current.split(":") : [];
  const hour = rawHour ? rawHour.padStart(2, "0") : "";
  const minute = rawMinute.padStart(2, "0");

  const minutes: string[] = [];
  for (let m = 0; m < 60; m += minuteStep) minutes.push(String(m).padStart(2, "0"));
  // Keep an existing odd minute (say :07) selectable rather than silently changing it.
  if (!minutes.includes(minute)) minutes.push(minute);
  minutes.sort();

  function set(next: string) {
    if (value === undefined) setInner(next);
    onChange?.(next);
  }

  const composed = hour ? `${hour}:${minute}` : "";
  const selectClass =
    "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400";

  return (
    <span className="inline-flex items-center gap-1">
      <select
        aria-label={`${label}, hour`}
        value={hour}
        disabled={disabled}
        onChange={(e) => set(e.target.value ? `${e.target.value}:${minute}` : "")}
        className={selectClass}
      >
        <option value="">--</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-zinc-400" aria-hidden="true">
        :
      </span>
      <select
        aria-label={`${label}, minutes`}
        value={minute}
        disabled={disabled || !hour}
        onChange={(e) => set(hour ? `${hour}:${e.target.value}` : "")}
        className={selectClass}
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      {name && <input type="hidden" name={name} value={composed} disabled={disabled} />}
    </span>
  );
}
