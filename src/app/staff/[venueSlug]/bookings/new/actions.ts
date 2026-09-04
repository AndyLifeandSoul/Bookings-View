"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { findTableConflicts } from "@/lib/staff/table-conflicts";
import { formatBookingRef } from "@/lib/bookings/booking-reference";
import type { ActionResult } from "@/components/action-form";

/** Same "trust nothing but the session" shape as the booking-details actions — see that file's requireVenueAccess doc comment. */
async function requireVenueAccess(venueId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Not signed in." };
  if (session.role === "STAFF" && session.venueId !== venueId) {
    return { error: "That venue isn't yours." };
  }
  return { ok: true };
}

function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Manual "Add booking" — a phoned-in or walk-in booking staff enter
 * directly, skipping the customer widget's availability/deposit flow
 * entirely (this always creates a CONFIRMED booking with a table already
 * picked, not something needing payment or slot validation). Per Andy's
 * rules: a same-day booking only needs a time, name, table and booking
 * type — no contact details required (someone booking a table for tonight
 * over the phone doesn't need to give an email). A future-dated booking
 * needs a name and at least one of email/phone, plus who took it, since
 * there's no other record of that conversation.
 */
export async function createManualBooking(formData: FormData): Promise<ActionResult> {
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, bookingCode: true } });
  if (!venue) return { error: "Unknown venue." };

  const dateStr = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "A valid date is required." };
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const isSameDay = date.getTime() === todayUtcDateOnly().getTime();

  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(startTime) || !/^\d{1,2}:\d{2}$/.test(endTime)) {
    return { error: "Start and end time are required." };
  }

  const bookingTypeId = String(formData.get("bookingTypeId") ?? "");
  const bookingType = await prisma.bookingType.findFirst({ where: { id: bookingTypeId, venueId } });
  if (!bookingType) return { error: "Pick a booking type." };

  const customerName = String(formData.get("customerName") ?? "").trim();
  if (!customerName) return { error: "Customer name is required." };
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const takenByStaffName = String(formData.get("takenByStaffName") ?? "").trim() || null;

  const partySizeRaw = Number(formData.get("partySize"));
  if (!Number.isFinite(partySizeRaw) || partySizeRaw < 1) return { error: "Party size must be at least 1." };
  const partySize = Math.trunc(partySizeRaw);

  const tableIds = formData.getAll("tableIds").map(String).filter(Boolean);

  if (isSameDay) {
    if (tableIds.length === 0) return { error: "A same-day booking needs at least one table." };
  } else {
    if (!customerEmail && !customerPhone) {
      return { error: "A future-dated booking needs an email or phone number for the customer." };
    }
    if (!takenByStaffName) return { error: "Enter who took this booking." };
  }
  if (customerEmail && !customerEmail.includes("@")) return { error: "Email doesn't look valid." };

  if (tableIds.length > 0) {
    const validTables = await prisma.table.count({ where: { id: { in: tableIds }, venueId } });
    if (validTables !== tableIds.length) return { error: "One or more selected tables don't belong to this venue." };

    const conflicts = await findTableConflicts({ venueId, date, startTime, endTime, tableIds });
    if (conflicts.length > 0) {
      const names = [...new Set(conflicts.map((c) => `${c.tableLabel} (${c.customerName}, ${c.startTime}-${c.endTime})`))];
      return { error: `Can't book, already booked at this time: ${names.join(", ")}.` };
    }
  }

  await prisma.$transaction(async (tx) => {
    let bookingRef: string | null = null;
    if (venue.bookingCode) {
      const updated = await tx.venue.update({
        where: { id: venue.id },
        data: { bookingRefCounter: { increment: 1 } },
        select: { bookingRefCounter: true },
      });
      bookingRef = formatBookingRef(venue.bookingCode, date, updated.bookingRefCounter);
    }

    return tx.booking.create({
      data: {
        venueId,
        bookingTypeId,
        bookingRef,
        date,
        startTime,
        endTime,
        partySize,
        status: "CONFIRMED",
        source: "PHONE",
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        takenByStaffName,
        bookingTables: tableIds.length > 0 ? { create: tableIds.map((tableId) => ({ tableId })) } : undefined,
      },
    });
  });

  redirect(`/staff/${venueSlug}/diary?date=${dateStr}`);
}

export interface TableAvailabilityInfo {
  /** Tables already seating a different active booking that overlaps this date/time range - see findTableConflicts. */
  unavailableTableIds: string[];
  /**
   * Best-fit available table(s) for this booking type/party size/time, if
   * any combination exists. A single id when one table fits on its own;
   * more than one only when the party doesn't fit any single table and a
   * *physically linked* combination (TableLink) does - see
   * findTableCombo's doc comment for why "linked" matters, e.g. never
   * Table 1 + Table 8 with nothing joining them. Staff still pick tables
   * themselves; this only flags a suggestion.
   */
  recommendedTableIds: string[];
}

interface CandidateTable {
  id: string;
  minCovers: number;
  maxCovers: number;
  areaId: string | null;
  sortOrder: number;
}

/**
 * Backs the "Add booking" form's live table picker: which tables are
 * already booked for this date/time (greyed out, not selectable), and
 * which available table(s) are the best fit for this booking type and
 * party size (flagged "Recommended"). Deliberately a much simpler
 * heuristic than lifeandsoul-bookings' real assignTables engine -
 * bookings-view doesn't run that engine, this only has to pick one
 * sensible option for a human to confirm or override, not replicate the
 * customer-facing allocation logic exactly.
 *
 * Tries a single table first (tightest fit - smallest maxCovers that
 * still fits partySize), within the booking type's allowed areas if
 * restricted via areaPriorities, in area-priority order. Only when no
 * single table fits does it fall back to a combination - see
 * findTableCombo - since Andy's spec is "multiple tables if needed", not
 * as a general alternative to a single table that would've done the job.
 */
export async function getTableAvailability(params: {
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingTypeId: string;
  partySize: number;
}): Promise<TableAvailabilityInfo> {
  const empty: TableAvailabilityInfo = { unavailableTableIds: [], recommendedTableIds: [] };
  const { venueId, date: dateStr, startTime, endTime, bookingTypeId, partySize } = params;

  const access = await requireVenueAccess(venueId);
  if ("error" in access) return empty;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return empty;
  if (!/^\d{1,2}:\d{2}$/.test(startTime) || !/^\d{1,2}:\d{2}$/.test(endTime)) return empty;
  if (!bookingTypeId || !Number.isInteger(partySize) || partySize < 1) return empty;
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const [tables, bookingType] = await Promise.all([
    prisma.table.findMany({
      where: { venueId, active: true },
      select: { id: true, minCovers: true, maxCovers: true, areaId: true, sortOrder: true },
    }),
    prisma.bookingType.findFirst({
      where: { id: bookingTypeId, venueId },
      select: { areaPriorities: { select: { areaId: true, priority: true }, orderBy: { priority: "asc" } } },
    }),
  ]);
  if (tables.length === 0) return empty;
  const tableIds = tables.map((t) => t.id);

  const conflicts = await findTableConflicts({ venueId, date, startTime, endTime, tableIds });
  const unavailableTableIds = [...new Set(conflicts.map((c) => c.tableId))];
  const unavailableSet = new Set(unavailableTableIds);

  const areaPriority = new Map((bookingType?.areaPriorities ?? []).map((ap) => [ap.areaId, ap.priority]));
  const restrictToAreas = areaPriority.size > 0;
  function priorityOf(t: CandidateTable): number {
    return restrictToAreas ? (areaPriority.get(t.areaId!) ?? 0) : 0;
  }

  // Every available, area-eligible table - the pool both the single-table
  // pick and the combo search draw from (a combo candidate doesn't need to
  // fit partySize on its own, only alongside whatever it's linked to).
  const available = tables.filter((t) => {
    if (unavailableSet.has(t.id)) return false;
    if (restrictToAreas && (!t.areaId || !areaPriority.has(t.areaId))) return false;
    return true;
  });

  const singleFit = available
    .filter((t) => partySize >= t.minCovers && partySize <= t.maxCovers)
    .sort((a, b) => {
      const p = priorityOf(a) - priorityOf(b);
      if (p !== 0) return p;
      if (a.maxCovers !== b.maxCovers) return a.maxCovers - b.maxCovers;
      return a.sortOrder - b.sortOrder;
    });

  if (singleFit.length > 0) {
    return { unavailableTableIds, recommendedTableIds: [singleFit[0].id] };
  }

  const links = await prisma.tableLink.findMany({
    where: { tableAId: { in: tableIds }, tableBId: { in: tableIds } },
    select: { tableAId: true, tableBId: true },
  });
  const adjacency = new Map<string, Set<string>>();
  for (const link of links) {
    if (!adjacency.has(link.tableAId)) adjacency.set(link.tableAId, new Set());
    if (!adjacency.has(link.tableBId)) adjacency.set(link.tableBId, new Set());
    adjacency.get(link.tableAId)!.add(link.tableBId);
    adjacency.get(link.tableBId)!.add(link.tableAId);
  }

  const combo = findTableCombo(available, adjacency, partySize, priorityOf);
  return { unavailableTableIds, recommendedTableIds: combo.map((t) => t.id) };
}

/**
 * Finds the smallest set of *physically linked* tables (TableLink -
 * "neighbouring tables that can be combined onto one booking together",
 * see that model's doc comment) whose combined maxCovers covers
 * partySize - i.e. only tables actually pushed together in real life, so
 * this can never suggest Table 1 + Table 8 with nothing joining them.
 * Requires the whole combination to be connected (every table reachable
 * from every other through link edges within the combination), not just
 * each pair independently linked to some third table, since that's what
 * "push these tables together" means physically.
 *
 * Bounded depth-first search from every candidate table, extending a
 * connected path one linked neighbour at a time; a path stops growing the
 * moment it covers partySize (adding more tables to an already-sufficient
 * combo is never a better answer) or hits maxComboSize. Table counts and
 * per-table link counts are small in practice (a handful of physically
 * adjacent tables per area), so the exponential worst case never
 * materialises - visitedCombos bounds it defensively regardless. Prefers
 * fewer tables, then the least spare capacity over partySize, then lower
 * area priority.
 */
function findTableCombo(
  candidates: CandidateTable[],
  adjacency: Map<string, Set<string>>,
  partySize: number,
  priorityOf: (t: CandidateTable) => number,
  maxComboSize = 5,
): CandidateTable[] {
  const byId = new Map(candidates.map((t) => [t.id, t]));
  let best: CandidateTable[] | null = null;
  let visitedCombos = 0;

  function isBetter(path: CandidateTable[]): boolean {
    if (!best) return true;
    if (path.length !== best.length) return path.length < best.length;
    const over = (p: CandidateTable[]) => p.reduce((s, t) => s + t.maxCovers, 0) - partySize;
    const pathOver = over(path);
    const bestOver = over(best);
    if (pathOver !== bestOver) return pathOver < bestOver;
    const prio = (p: CandidateTable[]) => p.reduce((s, t) => s + priorityOf(t), 0);
    return prio(path) < prio(best);
  }

  function dfs(path: CandidateTable[], visited: Set<string>) {
    if (++visitedCombos > 5000) return;
    const totalMax = path.reduce((s, t) => s + t.maxCovers, 0);
    if (totalMax >= partySize) {
      if (isBetter(path)) best = [...path];
      return;
    }
    if (path.length >= maxComboSize) return;

    const frontier = new Set<string>();
    for (const t of path) {
      for (const n of adjacency.get(t.id) ?? []) {
        if (!visited.has(n) && byId.has(n)) frontier.add(n);
      }
    }
    for (const n of frontier) {
      visited.add(n);
      dfs([...path, byId.get(n)!], visited);
      visited.delete(n);
    }
  }

  for (const start of candidates) {
    dfs([start], new Set([start.id]));
  }

  return best ?? [];
}
