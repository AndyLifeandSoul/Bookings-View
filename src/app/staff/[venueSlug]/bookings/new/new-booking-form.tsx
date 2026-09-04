"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createManualBooking, getTableAvailability } from "./actions";
import { TimeFields, computeEndTime, type BookingTypeOption } from "./time-fields";
import { Button } from "@/components/ui/button";

export interface TableOption {
  id: string;
  label: string;
  minCovers: number;
  maxCovers: number;
  areaId: string | null;
}

/**
 * The "Add booking" form, as one controlled client component rather than a
 * plain server-rendered <form> - three things needed that for:
 *
 * 1. Andy: "if there are any errors on the form when submitting a new
 *    booking it will clear the entire form rather than just flagging the
 *    issue and keeping the data." That was the old ActionForm-wrapped
 *    version's `<form action={formAction}>` (via useActionState) resetting
 *    every uncontrolled field once the action finished, success or error.
 *    Every field here is React state instead, so a failed submit changes
 *    nothing but the error message - nothing to reset.
 * 2. Live table availability/recommendation (below) needs the current
 *    date/booking type/time/party size on every change, which means
 *    controlled state for those regardless.
 * 3. The action is called directly (not wired to the form's `action` prop)
 *    so point 1 holds even if a future Next/React version changes exactly
 *    when the auto-reset fires - this form was never relying on that
 *    subtlety in the first place.
 *
 * Table availability: debounced ~250ms after date/time/type/partySize
 * settle, calls getTableAvailability and greys out (disables) any table
 * already booked for that window, tagging the best-fit available table
 * "Recommended". For a party too big for any single table, that can be
 * more than one table - always a physically linked combination (see
 * getTableAvailability/findTableCombo's doc comments for why - never a
 * pair of tables with nothing joining them), shown with a summary line
 * above the grid as well as the per-table tag, since "these two together"
 * needs to read as one suggestion, not two independent ones. If a table
 * the user had already picked becomes unavailable because they changed
 * the time/date afterwards, it's dropped from the selection automatically
 * and flagged in a small notice rather than left silently
 * checked-but-disabled (a disabled checkbox doesn't get submitted with
 * the form at all, which would otherwise lose that table from the
 * booking without telling anyone).
 */
export function NewBookingForm({
  venueId,
  venueSlug,
  defaultDate,
  bookingTypes,
  tables,
}: {
  venueId: string;
  venueSlug: string;
  defaultDate: string;
  bookingTypes: BookingTypeOption[];
  tables: TableOption[];
}) {
  const [date, setDate] = useState(defaultDate);
  const [bookingTypeId, setBookingTypeId] = useState(bookingTypes[0]?.id ?? "");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState(() => computeEndTime("18:00", bookingTypes[0]?.minDurationMinutes));
  const [partySize, setPartySize] = useState("2");
  const [takenByStaffName, setTakenByStaffName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableIds, setTableIds] = useState<Set<string>>(new Set());

  const [unavailableTableIds, setUnavailableTableIds] = useState<Set<string>>(new Set());
  const [recommendedTableIds, setRecommendedTableIds] = useState<string[]>([]);
  const [removedNotice, setRemovedNotice] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const requestId = useRef(0);

  function handleBookingTypeChange(id: string) {
    setBookingTypeId(id);
    const type = bookingTypes.find((t) => t.id === id);
    setEndTime(computeEndTime(startTime, type?.minDurationMinutes));
  }

  function handleStartTimeChange(value: string) {
    setStartTime(value);
    const type = bookingTypes.find((t) => t.id === bookingTypeId);
    setEndTime(computeEndTime(value, type?.minDurationMinutes));
  }

  function toggleTable(id: string) {
    setTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Live availability lookup, debounced so switching booking type then
  // adjusting start time doesn't fire two overlapping requests. requestId
  // guards against an older, slower response landing after a newer one.
  useEffect(() => {
    const partySizeNum = Number(partySize);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{1,2}:\d{2}$/.test(startTime) ||
      !/^\d{1,2}:\d{2}$/.test(endTime) ||
      !bookingTypeId ||
      !Number.isInteger(partySizeNum) ||
      partySizeNum < 1 ||
      tables.length === 0
    ) {
      return;
    }

    const thisRequest = ++requestId.current;
    const timer = setTimeout(() => {
      getTableAvailability({ venueId, date, startTime, endTime, bookingTypeId, partySize: partySizeNum }).then(
        (result) => {
          if (thisRequest !== requestId.current) return; // a newer request has already landed
          setUnavailableTableIds(new Set(result.unavailableTableIds));
          setRecommendedTableIds(result.recommendedTableIds);

          setTableIds((prev) => {
            const stillUnavailable = [...prev].filter((id) => result.unavailableTableIds.includes(id));
            if (stillUnavailable.length === 0) return prev;
            const labels = stillUnavailable
              .map((id) => tables.find((t) => t.id === id)?.label)
              .filter(Boolean)
              .join(", ");
            setRemovedNotice(`${labels} no longer available for this time, removed from your selection.`);
            const next = new Set(prev);
            for (const id of stillUnavailable) next.delete(id);
            return next;
          });
        },
      );
    }, 250);

    return () => clearTimeout(timer);
  }, [venueId, date, startTime, endTime, bookingTypeId, partySize, tables]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("venueId", venueId);
    fd.set("venueSlug", venueSlug);
    fd.set("date", date);
    fd.set("startTime", startTime);
    fd.set("endTime", endTime);
    fd.set("bookingTypeId", bookingTypeId);
    fd.set("partySize", partySize);
    fd.set("takenByStaffName", takenByStaffName);
    fd.set("customerName", customerName);
    fd.set("customerEmail", customerEmail);
    fd.set("customerPhone", customerPhone);
    for (const id of tableIds) fd.append("tableIds", id);

    startTransition(async () => {
      const result = await createManualBooking(fd);
      // A successful submit calls redirect() inside the action, which
      // throws and never returns here - only a validation failure does.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && (
        <p className="animate-in rounded-lg border border-red-100 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Date</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <TimeFields
          bookingTypes={bookingTypes}
          bookingTypeId={bookingTypeId}
          onBookingTypeChange={handleBookingTypeChange}
          startTime={startTime}
          onStartTimeChange={handleStartTimeChange}
          endTime={endTime}
          onEndTimeChange={setEndTime}
        />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Party size</span>
          <input
            type="number"
            min={1}
            required
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Taken by</span>
          <input
            type="text"
            placeholder="Your name"
            value={takenByStaffName}
            onChange={(e) => setTakenByStaffName(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Customer name</span>
        <input
          type="text"
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Phone</span>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>
      <p className="-mt-2 text-xs text-zinc-500">
        Not required for a same-day booking. For a future date, at least one of email or phone is required.
      </p>

      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Table(s)</legend>
        {tables.length === 0 ? (
          <p className="text-sm text-zinc-500">No tables set up for this venue yet.</p>
        ) : (
          <>
            {removedNotice && <p className="text-xs text-[var(--danger-soft-text)]">{removedNotice}</p>}
            {recommendedTableIds.length > 1 && (
              <p className="text-xs font-medium text-[var(--success-soft-text)]">
                Recommended combination: {recommendedLabel(recommendedTableIds, tables)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {tables.map((table) => {
                const unavailable = unavailableTableIds.has(table.id);
                const recommended = recommendedTableIds.includes(table.id);
                const selected = tableIds.has(table.id);
                return (
                  <label
                    key={table.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      unavailable
                        ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
                        : selected
                          ? "cursor-pointer border-[var(--accent)] bg-[var(--accent-soft)]"
                          : recommended
                            ? "cursor-pointer border-[var(--success-soft-text)]/40 bg-[var(--success-soft)] hover:border-[var(--success-soft-text)]/60"
                            : "cursor-pointer border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={unavailable}
                      onChange={() => toggleTable(table.id)}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    {table.label}
                    {unavailable && <span className="text-xs">(booked)</span>}
                    {!unavailable && recommended && (
                      <span className="text-xs font-medium text-[var(--success-soft-text)]">Recommended</span>
                    )}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </fieldset>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add booking"}
        </Button>
      </div>
    </form>
  );
}

function recommendedLabel(ids: string[], tables: TableOption[]): string {
  const picked = ids.map((id) => tables.find((t) => t.id === id)).filter((t): t is TableOption => Boolean(t));
  const seats = picked.reduce((s, t) => s + t.maxCovers, 0);
  return `${picked.map((t) => t.label).join(" + ")} (seats up to ${seats})`;
}
