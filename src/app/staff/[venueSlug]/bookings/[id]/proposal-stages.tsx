"use client";

import { useState } from "react";
import { DateSelect } from "@/components/date-select";

/** Rows for a staged payment schedule: label, amount, due date. Starts with a deposit row. */
export function ProposalStages() {
  const [rows, setRows] = useState([{ key: 0, label: "Deposit" }]);
  const [next, setNext] = useState(1);
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={row.key} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Payment</span>
            <input name="stageLabel" defaultValue={row.label} className="w-36 rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Amount (£)</span>
            <input name="stageAmount" type="number" min="0" step="0.01" className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Due (optional)</span>
            <DateSelect name="stageDue" label={`Payment ${i + 1} due`} />
          </div>
          {rows.length > 1 && (
            <button type="button" onClick={() => setRows(rows.filter((r) => r.key !== row.key))} className="pb-1.5 text-xs text-zinc-500 underline">
              Remove
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setRows([...rows, { key: next, label: rows.length === 1 ? "Balance" : `Payment ${rows.length + 1}` }]);
          setNext(next + 1);
        }}
        className="w-fit text-xs font-medium text-[var(--accent)] underline"
      >
        + Add a payment
      </button>
      <p className="text-xs text-zinc-500">Leave the amount blank on every row to send the proposal without payment links.</p>
    </div>
  );
}
