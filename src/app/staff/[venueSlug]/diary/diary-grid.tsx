"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { moveBookingTable } from "./actions";

export interface DiaryTable {
  id: string;
  label: string;
  areaName: string | null;
}

export interface DiaryBooking {
  id: string;
  customerName: string;
  partySize: number;
  status: string;
  startTime: string;
  endTime: string;
  bookingTypeName: string;
  /** Admin-set hex colour for this booking's type (see BookingType.color) — null falls back to colourForBookingType()'s deterministic palette below. */
  bookingTypeColor: string | null;
  /** Every table this booking currently occupies — a combined booking shows up on each of its rows. */
  tableIds: string[];
  /** ISO string once staff have marked this booking arrived, else null — see Booking.checkedInAt. */
  checkedInAt: string | null;
  /** ISO string once staff have cleared this booking's table, else null — see Booking.checkedOutAt. A checked-out booking still occupies its row here (so staff can see what just left) but is excluded from every server-side conflict check. */
  checkedOutAt: string | null;
}

/**
 * Small fixed palette a booking type's colour banner falls back to when no
 * admin colour has been set (BookingType.color is null) — picked
 * deterministically from the booking type's own name so the same type
 * always gets the same fallback colour on every render, without needing a
 * colour actually stored anywhere.
 */
const FALLBACK_PALETTE = ["#7c3aed", "#0891b2", "#c2410c", "#15803d", "#be185d", "#4338ca", "#a16207", "#0f766e"];

function colourForBookingType(bookingTypeName: string, explicitColor: string | null): string {
  if (explicitColor) return explicitColor;
  let hash = 0;
  for (let i = 0; i < bookingTypeName.length; i++) hash = (hash * 31 + bookingTypeName.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-green-100 border-green-300 text-green-900",
  PENDING_PAYMENT: "bg-amber-100 border-amber-300 text-amber-900",
  ENQUIRY: "bg-blue-100 border-blue-300 text-blue-900",
  COMPLETED: "bg-zinc-100 border-zinc-300 text-zinc-600",
  NO_SHOW: "bg-red-100 border-red-300 text-red-900",
};

/** Minutes since midnight, tolerant of the >=1440 overnight values this app's bookings use — see lib/bookings/time.ts. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

interface DragPayload {
  bookingId: string;
  fromTableId: string | null;
}

export function DiaryGrid({
  venueId,
  venueSlug,
  tables,
  bookings,
  startMinutes,
  endMinutes,
}: {
  venueId: string;
  venueSlug: string;
  tables: DiaryTable[];
  bookings: DiaryBooking[];
  startMinutes: number;
  endMinutes: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);

  const span = Math.max(endMinutes - startMinutes, 60);
  const hourMarks: number[] = [];
  for (let h = Math.ceil(startMinutes / 60); h * 60 <= endMinutes; h++) hourMarks.push(h * 60);

  const unassigned = bookings.filter((b) => b.tableIds.length === 0);

  function handleDrop(toTableId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverTableId(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await moveBookingTable({
        bookingId: payload.bookingId,
        fromTableId: payload.fromTableId,
        toTableId,
        venueId,
        venueSlug,
      });
      if (!result.ok) setError(result.error ?? "Couldn't move that booking.");
    });
  }

  function pctLeft(minutes: number): number {
    return ((Math.max(minutes, startMinutes) - startMinutes) / span) * 100;
  }
  function pctWidth(start: number, end: number): number {
    const clampedStart = Math.max(start, startMinutes);
    const clampedEnd = Math.min(end, endMinutes);
    return Math.max(((clampedEnd - clampedStart) / span) * 100, 2);
  }

  function BookingBlock({ booking, fromTableId }: { booking: DiaryBooking; fromTableId: string | null }) {
    // Checked-out bookings stay on the grid (so staff can see what just left)
    // but are dimmed and badged "OUT" since their table is already free
    // again server-side — see Booking.checkedOutAt.
    const checkInOutTitle = booking.checkedOutAt
      ? " · checked out, table free"
      : booking.checkedInAt
        ? " · checked in"
        : "";
    return (
      <Link
        href={`/staff/${venueSlug}/bookings/${booking.id}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", JSON.stringify({ bookingId: booking.id, fromTableId } satisfies DragPayload));
        }}
        title={`${booking.bookingTypeName} · ${booking.customerName} · ${booking.partySize} guests · ${booking.startTime}-${booking.endTime}${checkInOutTitle}`}
        className={`absolute top-1 bottom-1 flex flex-col overflow-hidden rounded-md border text-xs leading-tight shadow-sm hover:z-10 hover:shadow-md ${STATUS_COLORS[booking.status] ?? "bg-zinc-100 border-zinc-300 text-zinc-700"} ${booking.checkedOutAt ? "opacity-50" : ""}`}
        style={{ left: `${pctLeft(toMinutes(booking.startTime))}%`, width: `${pctWidth(toMinutes(booking.startTime), toMinutes(booking.endTime))}%` }}
      >
        <span
          className="flex items-center justify-between gap-1 px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: colourForBookingType(booking.bookingTypeName, booking.bookingTypeColor) }}
        >
          <span className="truncate">{booking.bookingTypeName}</span>
          {booking.checkedOutAt ? (
            <span className="shrink-0 rounded-sm bg-black/30 px-1">OUT</span>
          ) : booking.checkedInAt ? (
            <span className="shrink-0 rounded-sm bg-black/30 px-1">IN</span>
          ) : null}
        </span>
        <span className="flex flex-1 flex-col justify-center overflow-hidden px-2">
          <span className="truncate font-medium">{booking.customerName}</span>
          <span className="truncate opacity-80">
            {booking.partySize} · {booking.startTime}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {isPending && <p className="text-xs text-zinc-400">Saving…</p>}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-[720px]">
          {/* Time axis */}
          <div className="flex border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
            <div className="w-32 shrink-0 border-r border-zinc-200 px-2 py-2 font-medium text-zinc-600">Table</div>
            <div className="relative h-8 flex-1">
              {hourMarks.map((m) => (
                <span key={m} className="absolute top-2 -translate-x-1/2" style={{ left: `${pctLeft(m)}%` }}>
                  {String(Math.floor((m / 60) % 24)).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>

          {tables.map((table) => {
            const rowBookings = bookings.filter((b) => b.tableIds.includes(table.id));
            return (
              <div
                key={table.id}
                className={`flex border-b border-zinc-100 last:border-0 ${dragOverTableId === table.id ? "bg-blue-50" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverTableId(table.id);
                }}
                onDragLeave={() => setDragOverTableId((cur) => (cur === table.id ? null : cur))}
                onDrop={(e) => handleDrop(table.id, e)}
              >
                <div className="w-32 shrink-0 border-r border-zinc-200 px-2 py-3 text-sm">
                  <div className="font-medium text-zinc-900">{table.label}</div>
                  {table.areaName && <div className="text-xs text-zinc-400">{table.areaName}</div>}
                </div>
                <div className="relative h-16 flex-1">
                  {hourMarks.map((m) => (
                    <div key={m} className="absolute top-0 bottom-0 w-px bg-zinc-100" style={{ left: `${pctLeft(m)}%` }} />
                  ))}
                  {rowBookings.map((booking) => (
                    <BookingBlock key={`${booking.id}-${table.id}`} booking={booking} fromTableId={table.id} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unassigned.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-700">Unassigned</h3>
          <p className="mt-1 text-xs text-zinc-500">Drag onto a table row above to seat.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unassigned.map((booking) => (
              <Link
                key={booking.id}
                href={`/staff/${venueSlug}/bookings/${booking.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "text/plain",
                    JSON.stringify({ bookingId: booking.id, fromTableId: null } satisfies DragPayload),
                  );
                }}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs shadow-sm ${STATUS_COLORS[booking.status] ?? "bg-zinc-100 border-zinc-300 text-zinc-700"}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: colourForBookingType(booking.bookingTypeName, booking.bookingTypeColor) }}
                  title={booking.bookingTypeName}
                />
                <span className="font-medium">{booking.customerName}</span> · {booking.partySize} ·{" "}
                {booking.startTime}-{booking.endTime}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
