"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createManualBooking, getTableAvailability, searchGuests, type GuestMatch } from "./actions";
import { TimeFields, computeEndTime, type BookingTypeOption } from "./time-fields";
import { Button } from "@/components/ui/button";
import { DateSelect } from "@/components/date-select";
import { OCCASIONS } from "@/lib/bookings/occasions";

export interface TableOption {
  id: string;
  label: string;
  minCovers: number;
  maxCovers: number;
  areaId: string | null;
}

/**
 * The "Add booking" form for phoned-in and in-person bookings.
 *
 * Every field is React state, so a failed save shows the error and keeps
 * everything typed. The action is called directly rather than through the
 * form's action prop for the same reason.
 *
 * As the date, times, type and party size change, the table list below is
 * refreshed (debounced) from getTableAvailability: booked tables are greyed
 * out, the best fit is marked, and a picked table that becomes booked is
 * dropped with a notice. Tables are grouped by area.
 *
 * Typing a name, email or phone looks up past guests, so a regular's
 * details, tags and allergies can be filled in with one tap.
 */
export function NewBookingForm({
  venueId,
  venueSlug,
  defaultDate,
  bookingTypes,
  tables,
  areas,
  staffName,
}: {
  venueId: string;
  venueSlug: string;
  defaultDate: string;
  bookingTypes: BookingTypeOption[];
  tables: TableOption[];
  areas: { id: string; name: string }[];
  staffName: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [bookingTypeId, setBookingTypeId] = useState(bookingTypes[0]?.id ?? "");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState(() => computeEndTime("18:00", bookingTypes[0]?.minDurationMinutes));
  const [partySize, setPartySize] = useState("2");
  const [takenByStaffName, setTakenByStaffName] = useState(staffName);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [occasion, setOccasion] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [staffNotes, setStaffNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [tableIds, setTableIds] = useState<Set<string>>(new Set());

  const [unavailableTableIds, setUnavailableTableIds] = useState<Set<string>>(new Set());
  const [recommendedTableIds, setRecommendedTableIds] = useState<string[]>([]);
  const [removedNotice, setRemovedNotice] = useState<string | null>(null);

  const [matches, setMatches] = useState<GuestMatch[]>([]);
  const [pickedGuest, setPickedGuest] = useState<GuestMatch | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);
  const searchId = useRef(0);

  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const isToday = date === today;
  const hasEmail = customerEmail.includes("@");

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

  // Live table availability, debounced; requestId drops stale responses.
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
      getTableAvailability({ venueId, date, startTime, endTime, bookingTypeId, partySize: partySizeNum }).then((result) => {
        if (thisRequest !== requestId.current) return;
        setUnavailableTableIds(new Set(result.unavailableTableIds));
        setRecommendedTableIds(result.recommendedTableIds);
        setTableIds((prev) => {
          const nowBooked = [...prev].filter((id) => result.unavailableTableIds.includes(id));
          if (nowBooked.length === 0) return prev;
          const labels = nowBooked
            .map((id) => tables.find((t) => t.id === id)?.label)
            .filter(Boolean)
            .join(", ");
          setRemovedNotice(`${labels} ${nowBooked.length === 1 ? "is" : "are"} booked at this time, so we took ${nowBooked.length === 1 ? "it" : "them"} off.`);
          const next = new Set(prev);
          for (const id of nowBooked) next.delete(id);
          return next;
        });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [venueId, date, startTime, endTime, bookingTypeId, partySize, tables]);

  // Returning guest lookup on whichever contact field was typed in last.
  function lookup(q: string) {
    const query = q.trim();
    const thisSearch = ++searchId.current;
    if (query.length < 3) {
      setMatches([]);
      return;
    }
    setTimeout(() => {
      if (thisSearch !== searchId.current) return;
      searchGuests(venueId, query).then((found) => {
        if (thisSearch === searchId.current) setMatches(found);
      });
    }, 250);
  }

  function pickGuest(g: GuestMatch) {
    searchId.current++;
    setPickedGuest(g);
    setMatches([]);
    setCustomerName(g.name);
    setCustomerEmail(g.email ?? "");
    setCustomerPhone(g.phone ?? "");
    if (g.allergies && !dietaryNotes) setDietaryNotes(g.allergies);
  }

  const tablesByArea = useMemo(() => {
    const groups = new Map<string, TableOption[]>();
    for (const t of tables) {
      const key = t.areaId ?? "";
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    const ordered = areas.filter((a) => groups.has(a.id)).map((a) => ({ name: a.name, tables: groups.get(a.id)! }));
    if (groups.has("")) ordered.push({ name: areas.length > 0 ? "No area" : "Tables", tables: groups.get("")! });
    return ordered;
  }, [tables, areas]);

  const pickedSeats = [...tableIds].reduce((sum, id) => sum + (tables.find((t) => t.id === id)?.maxCovers ?? 0), 0);

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
    fd.set("occasion", occasion);
    fd.set("dietaryNotes", dietaryNotes);
    fd.set("notes", notes);
    fd.set("staffNotes", staffNotes);
    fd.set("sendEmail", sendEmail && hasEmail ? "on" : "off");
    for (const id of tableIds) fd.append("tableIds", id);
    startTransition(async () => {
      const result = await createManualBooking(fd);
      // Success redirects inside the action, so only an error comes back.
      if (result?.error) {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const input = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";
  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="animate-in rounded-lg border border-red-100 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>When</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Date</span>
            <DateSelect name="_date" defaultValue={date} onChange={(v) => v && setDate(v)} label="Booking date" />
          </div>
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
            <span className="text-sm font-medium text-zinc-700">Guests</span>
            <input
              type="number"
              min={1}
              required
              inputMode="numeric"
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              className={`${input} w-28`}
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Guest</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            type="text"
            required
            autoComplete="off"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setPickedGuest(null);
              lookup(e.target.value);
            }}
            className={input}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Phone</span>
            <input
              type="tel"
              autoComplete="off"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value);
                setPickedGuest(null);
                lookup(e.target.value);
              }}
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input
              type="email"
              autoComplete="off"
              value={customerEmail}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                setPickedGuest(null);
                lookup(e.target.value);
              }}
              className={input}
            />
          </label>
        </div>
        <p className="-mt-1 text-xs text-zinc-500">
          {isToday ? "Contact details are optional for tonight." : "For a future date, add a phone number or email."}
        </p>

        {matches.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
            <p className="px-2 pt-1 text-xs font-medium text-zinc-500">Been in before?</p>
            {matches.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => pickGuest(g)}
                className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-zinc-50"
              >
                <span className="text-sm font-medium text-zinc-900">
                  {g.name}
                  {g.tags.map((t) => (
                    <span key={t} className="ml-1.5 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-soft-text)]">
                      {t}
                    </span>
                  ))}
                </span>
                <span className="text-xs text-zinc-500">
                  {[g.phone, g.email, `${g.visits} ${g.visits === 1 ? "visit" : "visits"}`].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </div>
        )}

        {pickedGuest && (pickedGuest.allergies || pickedGuest.staffNotes || pickedGuest.noShows > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {pickedGuest.allergies && <p>Allergies on file: {pickedGuest.allergies}</p>}
            {pickedGuest.staffNotes && <p>Note: {pickedGuest.staffNotes}</p>}
            {pickedGuest.noShows > 0 && (
              <p>
                {pickedGuest.noShows} no-show{pickedGuest.noShows === 1 ? "" : "s"} before.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Occasion</span>
            <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className={input}>
              <option value="">None</option>
              {OCCASIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Allergies or dietary needs</span>
            <input type="text" value={dietaryNotes} onChange={(e) => setDietaryNotes(e.target.value)} placeholder="e.g. nut allergy, 2 vegan" className={input} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Guest&apos;s requests</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything they asked for" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Staff note</span>
          <textarea value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} rows={2} placeholder="Only staff see this" className={input} />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={sectionTitle}>Tables</h2>
          {tableIds.size > 0 && (
            <span className="text-xs text-zinc-600">
              {tableIds.size} picked, seats up to {pickedSeats}
            </span>
          )}
        </div>
        {tables.length === 0 ? (
          <p className="text-sm text-zinc-500">No tables set up yet. Add them in Settings, Tables and areas.</p>
        ) : (
          <>
            {removedNotice && <p className="text-xs text-[var(--danger-soft-text)]">{removedNotice}</p>}
            {recommendedTableIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-[var(--success-soft-text)]">Best fit: {recommendedLabel(recommendedTableIds, tables)}</span>
                <button
                  type="button"
                  onClick={() => setTableIds(new Set(recommendedTableIds))}
                  className="rounded-md border border-zinc-300 px-2 py-0.5 font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Use this
                </button>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {tablesByArea.map((group) => (
                <div key={group.name} className="flex flex-col gap-1.5">
                  {tablesByArea.length > 1 && <span className="text-xs font-medium text-zinc-500">{group.name}</span>}
                  <div className="flex flex-wrap gap-1.5">
                    {group.tables.map((table) => {
                      const unavailable = unavailableTableIds.has(table.id);
                      const recommended = recommendedTableIds.includes(table.id);
                      const selected = tableIds.has(table.id);
                      return (
                        <label
                          key={table.id}
                          title={`Seats ${table.minCovers} to ${table.maxCovers}`}
                          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)] ${
                            unavailable
                              ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400 line-through"
                              : selected
                                ? "cursor-pointer border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)]"
                                : recommended
                                  ? "cursor-pointer border-[var(--success-soft-text)]/40 bg-[var(--success-soft)]"
                                  : "cursor-pointer border-zinc-300 bg-white hover:border-zinc-400"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={unavailable}
                            onChange={() => toggleTable(table.id)}
                            className="sr-only"
                          />
                          <span className="font-medium">{table.label}</span>
                          <span className="text-xs opacity-70">{table.maxCovers}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Crossed out tables are already booked at this time. The number is how many each seats.</p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-zinc-100 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Taken by</span>
            <input type="text" value={takenByStaffName} onChange={(e) => setTakenByStaffName(e.target.value)} className={input} />
          </label>
          <label className={`flex items-center gap-2 self-end pb-2 text-sm ${hasEmail ? "text-zinc-700" : "text-zinc-400"}`}>
            <input
              type="checkbox"
              checked={sendEmail && hasEmail}
              disabled={!hasEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Email the guest a confirmation
          </label>
        </div>
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding..." : "Add booking"}
          </Button>
        </div>
      </section>
    </form>
  );
}

function recommendedLabel(ids: string[], tables: TableOption[]): string {
  const picked = ids.map((id) => tables.find((t) => t.id === id)).filter((t): t is TableOption => Boolean(t));
  const seats = picked.reduce((s, t) => s + t.maxCovers, 0);
  return `${picked.map((t) => t.label).join(" + ")} (seats ${seats})`;
}
