import { prisma } from "@/lib/db/client";
import { findTableConflicts } from "@/lib/staff/table-conflicts";

export interface TableAvailabilityInfo {
  /** Tables already seating a different active booking that overlaps this date/time range - see findTableConflicts. */
  unavailableTableIds: string[];
  /**
   * Best-fit available table(s) for this booking type/party size/time, if
   * any combination exists. A single id when one table fits on its own;
   * more than one only when the party doesn't fit any single table and a
   * defined TableCombination does (only tables the venue actually set up as
   * a combination together, see findCombination). Staff still pick tables
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
 * single table fits does it fall back to a defined combination - see
 * findCombination - since Andy's spec is "multiple tables if needed", not
 * as a general alternative to a single table that would've done the job.
 */
export async function computeTableAvailability(params: {
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingTypeId: string;
  partySize: number;
}): Promise<TableAvailabilityInfo> {
  const empty: TableAvailabilityInfo = { unavailableTableIds: [], recommendedTableIds: [] };
  const { venueId, date: dateStr, startTime, endTime, bookingTypeId, partySize } = params;

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

  const combinationRows = await prisma.tableCombination.findMany({
    where: { venueId },
    select: { entries: { select: { tableId: true } } },
  });
  const combinations = combinationRows.map((c) => c.entries.map((e) => e.tableId));

  const combo = findCombination(available, combinations, partySize, priorityOf);
  return { unavailableTableIds, recommendedTableIds: combo.map((t) => t.id) };
}

/**
 * The defined table combination that best seats partySize using only tables
 * in `candidates` (already free-and-eligible). A combination is usable only
 * when every one of its tables is available. Prefers fewest tables, then the
 * least spare capacity over partySize, then lower area priority - the same
 * tie-breaks the old adjacency search used. Returns [] when no defined
 * combination fits, so the picker simply shows no recommendation.
 */
function findCombination(
  candidates: CandidateTable[],
  combinations: string[][],
  partySize: number,
  priorityOf: (t: CandidateTable) => number,
): CandidateTable[] {
  const byId = new Map(candidates.map((t) => [t.id, t]));
  let best: CandidateTable[] | null = null;

  const over = (p: CandidateTable[]) => p.reduce((s, t) => s + t.maxCovers, 0) - partySize;
  const prio = (p: CandidateTable[]) => p.reduce((s, t) => s + priorityOf(t), 0);
  const isBetter = (rows: CandidateTable[]): boolean => {
    if (!best) return true;
    if (rows.length !== best.length) return rows.length < best.length;
    if (over(rows) !== over(best)) return over(rows) < over(best);
    return prio(rows) < prio(best);
  };

  for (const tableIds of combinations) {
    if (tableIds.length < 2) continue;
    const rows: CandidateTable[] = [];
    let allAvailable = true;
    for (const id of tableIds) {
      const table = byId.get(id);
      if (!table) {
        allAvailable = false;
        break;
      }
      rows.push(table);
    }
    if (!allAvailable) continue;
    if (rows.reduce((sum, t) => sum + t.maxCovers, 0) < partySize) continue;
    if (isBetter(rows)) best = rows;
  }

  return best ?? [];
}

