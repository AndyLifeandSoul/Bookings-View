import Link from "next/link";
import type { DiaryBooking, DiaryTable } from "./diary-grid";

/**
 * The collapsible booking list beside the diary grid, matching DMN's diary
 * sidebar: today's bookings grouped by status, each row clickable to open
 * the booking overlay (the same intercepted /bookings/[id] route the grid
 * blocks open, so it slides over the diary rather than navigating away).
 * Gives staff the familiar "scan the list, click a name" way in, alongside
 * the visual grid, instead of only being able to find a booking by hunting
 * for its block on the timeline.
 */

interface Group {
  key: string;
  label: string;
  bookings: DiaryBooking[];
  defaultOpen: boolean;
}

function tableLabels(booking: DiaryBooking, tablesById: Map<string, string>): string {
  const labels = booking.tableIds.map((id) => tablesById.get(id)).filter((l): l is string => !!l);
  return labels.length > 0 ? labels.join(", ") : "No table";
}

export function DiarySidebar({
  venueSlug,
  bookings,
  tables,
}: {
  venueSlug: string;
  bookings: DiaryBooking[];
  tables: DiaryTable[];
}) {
  const tablesById = new Map(tables.map((t) => [t.id, t.label]));
  const byStart = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Finished = completed or already checked out and gone; No show its own
  // group; Enquiries their own; everything else (confirmed / pending) is a
  // live booking. Mirrors DMN's Bookings / Open enquiries / Finished /
  // (No show) split.
  const finished = byStart.filter((b) => b.status === "COMPLETED" || b.checkedOutAt !== null);
  const remaining = byStart.filter((b) => b.status !== "COMPLETED" && b.checkedOutAt === null);
  const enquiries = remaining.filter((b) => b.status === "ENQUIRY");
  const noShows = remaining.filter((b) => b.status === "NO_SHOW");
  const live = remaining.filter((b) => b.status !== "ENQUIRY" && b.status !== "NO_SHOW");

  const groups: Group[] = [
    { key: "bookings", label: "Bookings", bookings: live, defaultOpen: true },
    { key: "enquiries", label: "Open enquiries", bookings: enquiries, defaultOpen: enquiries.length > 0 },
    { key: "finished", label: "Finished", bookings: finished, defaultOpen: false },
    { key: "noshow", label: "No shows", bookings: noShows, defaultOpen: false },
  ];

  const totalCovers = live.reduce((sum, b) => sum + b.partySize, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm [box-shadow:var(--shadow-sm)]">
        <span className="font-semibold text-zinc-900">{live.length}</span>{" "}
        <span className="text-zinc-500">booking{live.length === 1 ? "" : "s"}</span>
        <span className="mx-1.5 text-zinc-300">·</span>
        <span className="font-semibold text-zinc-900">{totalCovers}</span>{" "}
        <span className="text-zinc-500">cover{totalCovers === 1 ? "" : "s"}</span>
      </div>

      {groups.map((group) => (
        <details
          key={group.key}
          open={group.defaultOpen && group.bookings.length > 0}
          className="rounded-lg border border-zinc-200 bg-white [box-shadow:var(--shadow-sm)]"
        >
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 select-none">
            <span>{group.label}</span>
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">{group.bookings.length}</span>
          </summary>
          {group.bookings.length > 0 && (
            <div className="flex flex-col border-t border-zinc-100">
              {group.bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/staff/${venueSlug}/bookings/${b.id}`}
                  className="flex items-start gap-2 border-b border-zinc-50 px-3 py-2 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40"
                >
                  <span
                    className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: b.bookingTypeColor ?? "var(--accent)" }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-zinc-900">{b.customerName}</span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500">{b.startTime}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                      <span>x{b.partySize}</span>
                      <span className="text-zinc-300">·</span>
                      <span className="truncate">{tableLabels(b, tablesById)}</span>
                      {b.hasPreOrder && <span className="text-zinc-300">· pre-order</span>}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
