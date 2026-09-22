"use client";

import { useState } from "react";

/**
 * The weekly opening-hours grid, matching DMN: each day is Open / Closed /
 * Private hire only as three radio columns (all options visible at once,
 * not hidden in a dropdown), plus a "Set all" row that applies one choice
 * to every day. Controlled so "Set all" and the per-day radios stay in
 * sync, but it submits the exact same field names the saveWeeklyHours
 * action already reads: state-${day}, and opensAt-${day}-hour/-minute /
 * closesAt-${day}-hour/-minute (the Safari-safe split, see TimeFieldSelect).
 */

type State = "open" | "closed" | "private_hire_only";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export interface WeeklyDay {
  day: number;
  label: string;
  state: State;
  opensAt: string; // "HH:mm"
  closesAt: string; // "HH:mm"
}

interface Row {
  state: State;
  opensHour: string;
  opensMinute: string;
  closesHour: string;
  closesMinute: string;
}

function toRow(d: WeeklyDay): Row {
  const [oh, om] = d.opensAt.split(":");
  const [ch, cm] = d.closesAt.split(":");
  return { state: d.state, opensHour: oh ?? "18", opensMinute: om ?? "00", closesHour: ch ?? "23", closesMinute: cm ?? "00" };
}

function TimeSelects({
  name,
  hour,
  minute,
  onHour,
  onMinute,
}: {
  name: string;
  hour: string;
  minute: string;
  onHour: (v: string) => void;
  onMinute: (v: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <select
        name={`${name}-hour`}
        value={hour}
        onChange={(e) => onHour(e.target.value)}
        className="rounded-md border border-zinc-300 px-1.5 py-1.5 text-sm"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-zinc-400">:</span>
      <select
        name={`${name}-minute`}
        value={minute}
        onChange={(e) => onMinute(e.target.value)}
        className="rounded-md border border-zinc-300 px-1.5 py-1.5 text-sm"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </span>
  );
}

const STATES: { value: State; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "private_hire_only", label: "Private hire only" },
];

export function WeeklyHoursTable({ days }: { days: WeeklyDay[] }) {
  const [rows, setRows] = useState<Row[]>(() => days.map(toRow));

  function patch(index: number, change: Partial<Row>) {
    setRows((cur) => cur.map((r, i) => (i === index ? { ...r, ...change } : r)));
  }

  function setAll(change: Partial<Row>) {
    setRows((cur) => cur.map((r) => ({ ...r, ...change })));
  }

  const allState: State | null = rows.every((r) => r.state === rows[0]?.state) ? (rows[0]?.state ?? null) : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2.5">Day</th>
            <th className="px-3 py-2.5 text-center">Open</th>
            <th className="px-3 py-2.5 text-center">Closed</th>
            <th className="px-3 py-2.5 text-center">Private hire only</th>
            <th className="px-4 py-2.5">Opens</th>
            <th className="px-4 py-2.5">Closes</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-zinc-100 bg-zinc-50/60">
            <td className="px-4 py-3 font-medium text-zinc-500">Set all</td>
            {STATES.map((s) => (
              <td key={s.value} className="px-3 py-3 text-center">
                <input
                  type="radio"
                  name="setall-state"
                  checked={allState === s.value}
                  onChange={() => setAll({ state: s.value })}
                  className="h-4 w-4"
                  aria-label={`Set all days to ${s.label}`}
                />
              </td>
            ))}
            <td className="px-4 py-3">
              <TimeSelects
                name="setall-opensAt"
                hour={rows[0]?.opensHour ?? "18"}
                minute={rows[0]?.opensMinute ?? "00"}
                onHour={(v) => setAll({ opensHour: v })}
                onMinute={(v) => setAll({ opensMinute: v })}
              />
            </td>
            <td className="px-4 py-3">
              <TimeSelects
                name="setall-closesAt"
                hour={rows[0]?.closesHour ?? "23"}
                minute={rows[0]?.closesMinute ?? "00"}
                onHour={(v) => setAll({ closesHour: v })}
                onMinute={(v) => setAll({ closesMinute: v })}
              />
            </td>
          </tr>

          {days.map((d, i) => {
            const row = rows[i];
            return (
              <tr key={d.day} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                <td className="px-4 py-3 font-medium text-zinc-900">{d.label}</td>
                {STATES.map((s) => (
                  <td key={s.value} className="px-3 py-3 text-center">
                    <input
                      type="radio"
                      name={`state-${d.day}`}
                      value={s.value}
                      checked={row.state === s.value}
                      onChange={() => patch(i, { state: s.value })}
                      className="h-4 w-4"
                      aria-label={`${d.label}: ${s.label}`}
                    />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <TimeSelects
                    name={`opensAt-${d.day}`}
                    hour={row.opensHour}
                    minute={row.opensMinute}
                    onHour={(v) => patch(i, { opensHour: v })}
                    onMinute={(v) => patch(i, { opensMinute: v })}
                  />
                </td>
                <td className="px-4 py-3">
                  <TimeSelects
                    name={`closesAt-${d.day}`}
                    hour={row.closesHour}
                    minute={row.closesMinute}
                    onHour={(v) => patch(i, { closesHour: v })}
                    onMinute={(v) => patch(i, { closesMinute: v })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
