"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { createWalkIn } from "./actions";
import { buttonStyles } from "@/components/ui/button";

/**
 * Diary toolbar button + popup for adding a walk-in. Per Andy's spec, this
 * asks for a party size, one or more tables, and a booking type, everything
 * else (customer name "Walk in", start time, status, check-in)
 * is filled in server-side by createWalkIn. Tables are grouped by area
 * (DV8 alone has 46) and multi-select, since a walk-in party can be bigger
 * than any single table — e.g. a walk-in of 10 needs several tables pushed
 * together, the same way a phoned-in booking that size would. Not built on
 * top of ActionForm: that component always does a full router.refresh()
 * and has no way to close this popup on success without one, so this
 * manages its own pending/error state directly, same pattern as this
 * page's drag-drop (see moveBookingTable's call site in diary-grid.tsx).
 */
export function AddWalkInButton({
  venueId,
  venueSlug,
  dateStr,
  tables,
  bookingTypes,
}: {
  venueId: string;
  venueSlug: string;
  /** "YYYY-MM-DD", the diary date currently being viewed. */
  dateStr: string;
  tables: { id: string; label: string; areaName: string | null }[];
  bookingTypes: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [partySize, setPartySize] = useState("1");
  const [tableIds, setTableIds] = useState<Set<string>>(new Set());
  const [bookingTypeId, setBookingTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setPartySize("1");
    setTableIds(new Set());
    setBookingTypeId("");
  }

  function toggleTable(id: string) {
    setTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const partySizeNum = Number(partySize);
    if (!Number.isInteger(partySizeNum) || partySizeNum < 1) {
      setError("Party size must be at least 1.");
      return;
    }
    if (tableIds.size === 0 || !bookingTypeId) {
      setError("Pick at least one table and a booking type.");
      return;
    }
    setError(null);
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    startTransition(async () => {
      const result = await createWalkIn({
        venueId,
        venueSlug,
        date: dateStr,
        partySize: partySizeNum,
        tableIds: [...tableIds],
        bookingTypeId,
        startTime,
      });
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? "Couldn't add that walk-in.");
      }
    });
  }

  // Group tables by area, preserving the order they arrived in (already
  // area-priority-sorted by the diary page's query) so unassigned/no-area
  // tables fall wherever they naturally sort rather than being pulled out.
  const groups: { areaName: string; tables: typeof tables }[] = [];
  for (const t of tables) {
    const name = t.areaName ?? "Other";
    const g = groups.find((g) => g.areaName === name);
    if (g) g.tables.push(t);
    else groups.push({ areaName: name, tables: [t] });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonStyles("secondary", "sm")}>
        <UserPlus className="h-3.5 w-3.5" strokeWidth={2.25} />
        Add walk-in
      </button>

      {open && (
        <div
          className="animate-in fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 px-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">Add walk-in</h2>
              <button type="button" onClick={close} aria-label="Close" className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Blocks a table for someone who&apos;s just arrived, not added as a customer or to any marketing list.
              Check them out from the booking once they leave to free the table up again.
            </p>

            <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
              {error && (
                <p className="animate-in rounded-lg border border-red-100 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">
                  {error}
                </p>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Party size</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  className="w-24 rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">
                  Table{tableIds.size > 1 ? "s" : ""}{" "}
                  <span className="font-normal text-zinc-500">
                    {tableIds.size > 0 ? `(${tableIds.size} selected)` : "tick more than one for a bigger party"}
                  </span>
                </span>
                <div className="max-h-56 overflow-y-auto rounded-md border border-zinc-300 p-2">
                  {tables.length === 0 ? (
                    <p className="p-2 text-sm text-zinc-500">No tables set up for this venue yet.</p>
                  ) : (
                    groups.map((g) => (
                      <div key={g.areaName} className="mb-2 last:mb-0">
                        <p className="px-1 text-xs font-semibold uppercase text-zinc-400">{g.areaName}</p>
                        <div className="flex flex-wrap gap-1.5 p-1">
                          {g.tables.map((t) => (
                            <label
                              key={t.id}
                              className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm transition-colors ${
                                tableIds.has(t.id)
                                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                                  : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={tableIds.has(t.id)}
                                onChange={() => toggleTable(t.id)}
                                className="h-4 w-4 rounded border-zinc-300"
                              />
                              {t.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Booking type</span>
                <select
                  value={bookingTypeId}
                  onChange={(e) => setBookingTypeId(e.target.value)}
                  required
                  className="rounded-md border border-zinc-300 px-3 py-2"
                >
                  <option value="">Select a booking type…</option>
                  {bookingTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={close} className={buttonStyles("ghost", "md")}>
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className={buttonStyles("primary", "md")}>
                  {isPending ? "Adding…" : "Add walk-in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
