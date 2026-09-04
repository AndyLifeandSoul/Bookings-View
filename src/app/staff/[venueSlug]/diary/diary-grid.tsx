"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users2, LogIn, LogOut, ArrowRight, X, StickyNote } from "lucide-react";
import { moveBookingTable } from "./actions";
import { checkInBooking, checkOutBooking, undoCheckOut } from "../bookings/[id]/actions";
import { buttonStyles } from "@/components/ui/button";

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
  /** Admin-set hex colour for this booking's type (see BookingType.color), null falls back to colourForBookingType()'s deterministic palette below. */
  bookingTypeColor: string | null;
  /** Every table this booking currently occupies, a combined booking shows up on each of its rows. */
  tableIds: string[];
  /** ISO string once staff have marked this booking arrived, else null, see Booking.checkedInAt. */
  checkedInAt: string | null;
  /** ISO string once staff have cleared this booking's table, else null, see Booking.checkedOutAt. A checked-out booking still occupies its row here (so staff can see what just left) but is excluded from every server-side conflict check. */
  checkedOutAt: string | null;
  /** Free-text note from the customer or whoever took the booking (allergy, high chair, wheelchair access, birthday, ...). Surfaced as a small badge on the block itself, not just buried in the full booking page, since a note nobody notices until service is the whole reason this field exists. */
  notes: string | null;
}

/**
 * Small fixed palette a booking type's colour banner falls back to when no
 * admin colour has been set (BookingType.color is null), picked
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

/** Minutes since midnight, tolerant of the >=1440 overnight values this app's bookings use - see lib/bookings/time.ts. */
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
  isToday,
}: {
  venueId: string;
  venueSlug: string;
  tables: DiaryTable[];
  bookings: DiaryBooking[];
  startMinutes: number;
  endMinutes: number;
  /** Only draw the live "now" line (below) when the diary is actually showing today - the same line on a future or past date would just be misleading. */
  isToday: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
  // Minutes-since-midnight for "right now", re-read every 30s so the line
  // creeps across the grid in real time rather than freezing at page load -
  // this is what turns the diary from a static plan into something that
  // reads as "this is happening right now", which is the actual job of a
  // front-of-house screen glanced at all day. null until mounted, so the
  // server-rendered markup never disagrees with the client on "now".
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (!isToday) return;
    function tick() {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [isToday]);
  const [popover, setPopover] = useState<{
    booking: DiaryBooking;
    x: number;
    y: number;
    /** Which side of the anchor block the popover sits on, so its little arrow can point back the other way. */
    placement: "below" | "above";
    /** Arrow's horizontal offset from the popover's own left edge, so it stays lined up with the block/chip that was clicked even after the popover itself gets nudged to stay on-screen. */
    arrowLeft: number;
  } | null>(null);
  const [isTogglingArrival, startArrivalTransition] = useTransition();

  // Closes the popover on Escape - the backdrop click handles the other
  // "close without acting" path, this covers keyboard users and the habit
  // of tapping Escape to back out of a small floating panel.
  useEffect(() => {
    if (!popover) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPopover(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popover]);

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

  const POPOVER_WIDTH = 240;
  const POPOVER_HEIGHT_ESTIMATE = 150;
  const ANCHOR_GAP = 6;

  /**
   * Anchored to the clicked block/chip's own on-screen position (not the
   * raw cursor coordinates) - this is a mouse-driven front-of-house tool,
   * never touchscreens, so staff should barely have to move the pointer
   * between "click the booking" and "click Check in": the popover pops out
   * flush against the block, arrow included, rather than appearing loose
   * in whatever part of the page the click happened to land. Flips above
   * the block when there isn't room below (bottom table rows), and only
   * nudges sideways/vertically the minimum needed to stay on-screen.
   */
  function openPopover(booking: DiaryBooking, e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    let placement: "below" | "above" = "below";
    let y = rect.bottom + ANCHOR_GAP;
    if (y + POPOVER_HEIGHT_ESTIMATE > window.innerHeight - 8) {
      placement = "above";
      y = rect.top - POPOVER_HEIGHT_ESTIMATE - ANCHOR_GAP;
    }

    let x = rect.left;
    if (x + POPOVER_WIDTH > window.innerWidth - 8) x = window.innerWidth - POPOVER_WIDTH - 8;
    x = Math.max(x, 8);

    // Where the arrow sits along the popover's top/bottom edge, kept under
    // the block's own horizontal centre (clamped inside the popover) so it
    // still visibly connects back to the block even after the x-nudge above.
    const arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - x, 18), POPOVER_WIDTH - 18);

    setPopover({ booking, x, y: Math.max(y, 8), placement, arrowLeft });
  }

  function handleArrivalAction(booking: DiaryBooking) {
    const fd = new FormData();
    fd.set("id", booking.id);
    fd.set("venueId", venueId);
    fd.set("venueSlug", venueSlug);
    // Three states, three actions: not arrived yet -> check in; checked in
    // and still seated -> check out (this is what also flips status to
    // COMPLETED, see that action's doc comment); already checked out ->
    // undo, for the "wrong table, clicked check out by mistake" case.
    const action = booking.checkedOutAt ? undoCheckOut : booking.checkedInAt ? checkOutBooking : checkInBooking;
    startArrivalTransition(async () => {
      const result = await action(fd);
      if (result?.error) setError(result.error);
      else {
        setError(null);
        setPopover(null);
        router.refresh();
      }
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

  // null outside the visible window (before service starts, after it ends,
  // or not viewing today at all) so nothing renders rather than pinning the
  // line to an edge and implying "now" is at the start/end of the day.
  const nowLeftPct =
    nowMinutes !== null && nowMinutes >= startMinutes && nowMinutes <= endMinutes ? pctLeft(nowMinutes) : null;

  function BookingBlock({
    booking,
    fromTableId,
    isPrimary,
  }: {
    booking: DiaryBooking;
    fromTableId: string | null;
    /**
     * A combined booking (tableIds.length > 1) shows on every table it
     * spans, but only its first/primary table gets the full-colour
     * treatment - every other table shows the same block muted and
     * outlined, the convention both ResDiary and Access Collins use for
     * multi-table bookings, so a busy diary doesn't read as two separate
     * unrelated bookings that happen to share a name.
     */
    isPrimary: boolean;
  }) {
    // Checked-out bookings stay on the grid (so staff can see what just left)
    // but are dimmed and badged "OUT" since their table is already free
    // again server-side - see Booking.checkedOutAt.
    const checkInOutTitle = booking.checkedOutAt
      ? " · checked out, table free"
      : booking.checkedInAt
        ? " · checked in"
        : "";
    const noteTitle = booking.notes ? ` · note: ${booking.notes}` : "";
    return (
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", JSON.stringify({ bookingId: booking.id, fromTableId } satisfies DragPayload));
        }}
        onClick={(e) => openPopover(booking, e)}
        title={`${booking.bookingTypeName} · ${booking.customerName} · ${booking.partySize} guests · ${booking.startTime}-${booking.endTime}${checkInOutTitle}${noteTitle}`}
        className={`absolute top-1 bottom-1 flex cursor-pointer flex-col overflow-hidden rounded-md border text-left text-xs leading-tight shadow-sm transition-all duration-150 hover:z-10 hover:-translate-y-0.5 hover:shadow-md ${STATUS_COLORS[booking.status] ?? "bg-zinc-100 border-zinc-300 text-zinc-700"} ${booking.checkedOutAt ? "opacity-50" : ""} ${!isPrimary ? "opacity-60 saturate-50" : ""}`}
        style={{ left: `${pctLeft(toMinutes(booking.startTime))}%`, width: `${pctWidth(toMinutes(booking.startTime), toMinutes(booking.endTime))}%` }}
      >
        <span
          className="flex items-center justify-between gap-1 px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: colourForBookingType(booking.bookingTypeName, booking.bookingTypeColor) }}
        >
          <span className="truncate">{!isPrimary ? `↳ ${booking.bookingTypeName}` : booking.bookingTypeName}</span>
          <span className="flex shrink-0 items-center gap-1">
            {booking.notes && <StickyNote className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />}
            {booking.checkedOutAt ? (
              <span className="rounded-sm bg-black/30 px-1">OUT</span>
            ) : booking.checkedInAt ? (
              <span className="rounded-sm bg-black/30 px-1">IN</span>
            ) : null}
          </span>
        </span>
        <span className="flex flex-1 flex-col justify-center overflow-hidden px-2">
          <span className="truncate font-medium">{booking.customerName}</span>
          <span className="truncate opacity-80">
            {booking.partySize} · {booking.startTime}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="animate-in rounded-lg border border-red-100 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">
          {error}
        </p>
      )}
      {isPending && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-400">
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z" />
          </svg>
          Saving…
        </p>
      )}

      {unassigned.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <Users2 className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2.25} />
            Unassigned
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {unassigned.map((booking) => (
              <button
                key={booking.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "text/plain",
                    JSON.stringify({ bookingId: booking.id, fromTableId: null } satisfies DragPayload),
                  );
                }}
                onClick={(e) => openPopover(booking, e)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${STATUS_COLORS[booking.status] ?? "bg-zinc-100 border-zinc-300 text-zinc-700"}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: colourForBookingType(booking.bookingTypeName, booking.bookingTypeColor) }}
                  title={booking.bookingTypeName}
                />
                <span className="font-medium">{booking.customerName}</span> · {booking.partySize} ·{" "}
                {booking.startTime}-{booking.endTime}
                {booking.notes && <StickyNote className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.25} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white [box-shadow:var(--shadow-sm)]">
        <div className="min-w-[720px]">
          {/* Time axis */}
          <div className="flex border-b border-zinc-200 bg-zinc-50/80 text-xs text-zinc-500">
            <div className="w-32 shrink-0 border-r border-zinc-200 px-2 py-2 font-medium text-zinc-600">Table</div>
            <div className="relative h-8 flex-1">
              {hourMarks.map((m) => (
                <span key={m} className="absolute top-2 -translate-x-1/2" style={{ left: `${pctLeft(m)}%` }}>
                  {String(Math.floor((m / 60) % 24)).padStart(2, "0")}:00
                </span>
              ))}
              {/* The live "now" marker's label, sitting in the header so it
                  reads once rather than sixteen times down every row. */}
              {nowLeftPct !== null && (
                <span
                  className="absolute top-1.5 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[var(--now-line)] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                  style={{ left: `${nowLeftPct}%` }}
                >
                  <span className="h-1 w-1 rounded-full bg-white" />
                  Now
                </span>
              )}
            </div>
          </div>

          {tables.map((table) => {
            const rowBookings = bookings.filter((b) => b.tableIds.includes(table.id));
            return (
              <div
                key={table.id}
                className={`flex border-b border-zinc-100 transition-colors last:border-0 ${
                  dragOverTableId === table.id ? "bg-[var(--accent-soft)]" : "hover:bg-zinc-50/60"
                }`}
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
                  {/* Live "now" line - the single biggest reason a diary
                      screen glanced at across a shift should feel alive
                      rather than like a static printed floor plan. Drawn
                      per-row (not once over the whole table) since each
                      row has its own local time-axis coordinate space. */}
                  {nowLeftPct !== null && (
                    <div
                      className="absolute top-0 bottom-0 z-[5] w-px bg-[var(--now-line)]"
                      style={{ left: `${nowLeftPct}%` }}
                    />
                  )}
                  {rowBookings.map((booking) => (
                    <BookingBlock
                      key={`${booking.id}-${table.id}`}
                      booking={booking}
                      fromTableId={table.id}
                      isPrimary={table.id === booking.tableIds[0]}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {popover &&
        createPortal(
          <>
            {/* Full-screen transparent backdrop - click anywhere outside the
                popover to dismiss it without acting, same as tapping Escape. */}
            <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
          <div
            className="animate-in fixed z-50 w-60 overflow-visible rounded-xl border border-zinc-200 bg-white [box-shadow:var(--shadow-lg)]"
            style={{ left: popover.x, top: popover.y }}
          >
            {/* The little pointer that makes this read as "popped out of"
                the block/chip that was clicked, rather than a dialog that
                happens to be nearby - a rotated square, half tucked under
                the card's own border so the seam disappears. */}
            <div
              className={`absolute h-2.5 w-2.5 rotate-45 border-zinc-200 bg-white ${
                popover.placement === "below"
                  ? "-top-[5px] border-t border-l"
                  : "-bottom-[5px] border-b border-r"
              }`}
              style={{ left: popover.arrowLeft - 5 }}
            />
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">{popover.booking.customerName}</p>
                <p className="text-xs text-zinc-500">
                  {popover.booking.partySize} guests · {popover.booking.startTime}-{popover.booking.endTime} ·{" "}
                  {popover.booking.bookingTypeName}
                </p>
                {popover.booking.notes && (
                  <p className="mt-1 flex items-start gap-1 rounded-md bg-[var(--warning-soft)] px-1.5 py-1 text-xs text-[var(--warning-soft-text)]">
                    <StickyNote className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2.25} />
                    <span className="line-clamp-2">{popover.booking.notes}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPopover(null)}
                className="shrink-0 rounded-md p-0.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5 p-2">
              <button
                type="button"
                disabled={isTogglingArrival}
                onClick={() => handleArrivalAction(popover.booking)}
                className={buttonStyles("primary", "sm", "w-full justify-center")}
              >
                {popover.booking.checkedOutAt ? (
                  <>
                    <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {isTogglingArrival ? "Undoing…" : "Undo check-out"}
                  </>
                ) : popover.booking.checkedInAt ? (
                  <>
                    <LogOut className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {isTogglingArrival ? "Checking out…" : "Check out"}
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {isTogglingArrival ? "Checking in…" : "Check in"}
                  </>
                )}
              </button>
              <Link
                href={`/staff/${venueSlug}/bookings/${popover.booking.id}`}
                className={buttonStyles("ghost", "sm", "w-full justify-center")}
              >
                View details
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
              </Link>
            </div>
          </div>
          </>,
          document.body,
        )}
    </div>
  );
}
