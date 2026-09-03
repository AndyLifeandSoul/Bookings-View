"use client";

import { useState, useTransition } from "react";
import { createWalkIn } from "./actions";

/**
 * Diary toolbar button + popup for adding a walk-in. Per Andy's spec, this
 * asks for only a table and a booking type — everything else (customer
 * name "Walk in", start time, status, check-in) is filled in server-side by
 * createWalkIn. Not built on top of ActionForm: that component always does
 * a full router.refresh() and has no way to close this popup on success
 * without one, so this manages its own pending/error state directly, same
 * pattern as this page's drag-drop (see moveBookingTable's call site in
 * diary-grid.tsx).
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
  tables: { id: string; label: string }[];
  bookingTypes: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [tableId, setTableId] = useState("");
  const [bookingTypeId, setBookingTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setTableId("");
    setBookingTypeId("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tableId || !bookingTypeId) {
      setError("Pick a table and a booking type.");
      return;
    }
    setError(null);
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    startTransition(async () => {
      const result = await createWalkIn({ venueId, venueSlug, date: dateStr, tableId, bookingTypeId, startTime });
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? "Couldn't add that walk-in.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        Add walk-in
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={close}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-zinc-900">Add walk-in</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Blocks a table for someone who&apos;s just arrived — not added as a customer or to any marketing list.
              Check them out from the booking once they leave to free the table up again.
            </p>

            <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Table</span>
                <select
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  required
                  className="rounded-md border border-zinc-300 px-3 py-2"
                >
                  <option value="">Select a table…</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

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
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
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
