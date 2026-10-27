"use server";

import { randomBytes } from "node:crypto";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { findTableConflicts } from "@/lib/staff/table-conflicts";
import { formatBookingRef } from "@/lib/bookings/booking-reference";
import type { ActionResult } from "@/components/action-form";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking-confirmation";
import { logBookingEvent } from "@/lib/bookings/events";
import { isOccasion } from "@/lib/bookings/occasions";

/** Same "trust nothing but the session" shape as the booking-details actions - see that file's requireVenueAccess doc comment. */
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
 * Manual "Add booking" - a phoned-in or walk-in booking staff enter
 * directly, skipping the customer widget's availability/deposit flow
 * entirely (this always creates a CONFIRMED booking with a table already
 * picked, not something needing payment or slot validation). Per Andy's
 * rules: a same-day booking only needs a time, name, table and booking
 * type - no contact details required (someone booking a table for tonight
 * over the phone doesn't need to give an email). A future-dated booking
 * needs a name and at least one of email/phone, plus who took it, since
 * there's no other record of that conversation.
 */
export async function createManualBooking(formData: FormData): Promise<ActionResult> {
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, slug: true, bookingCode: true, name: true, email: true, logoUrl: true, logoImageType: true, brandColorHex: true, address: true, phone: true },
  });
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
  const occasionRaw = String(formData.get("occasion") ?? "").trim();
  const occasion = occasionRaw && isOccasion(occasionRaw) ? occasionRaw : null;
  const dietaryNotes = String(formData.get("dietaryNotes") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const staffNotes = String(formData.get("staffNotes") ?? "").trim() || null;
  const sendEmail = formData.get("sendEmail") !== "off";

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

  const booking = await prisma.$transaction(async (tx) => {
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
        manageToken: randomBytes(24).toString("base64url"),
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        takenByStaffName,
        occasion,
        dietaryNotes,
        notes,
        staffNotes,
        channel: "phone",
        bookingTables: tableIds.length > 0 ? { create: tableIds.map((tableId) => ({ tableId })) } : undefined,
      },
    });
  });

  const session = await getCurrentStaffSession();
  await logBookingEvent({
    bookingId: booking.id,
    actor: takenByStaffName ?? session?.name ?? "Staff",
    kind: "created",
    detail: `Booked by staff for ${partySize} at ${startTime}`,
  });

  // Fire the branded confirmation to the customer and log it on the
  // booking's message thread, exactly as the customer widget does. No-ops
  // when there's no email on file (a same-day phone booking may have none).
  if (sendEmail) await sendBookingConfirmationEmail({
    venue,
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    customerName,
    customerEmail,
    date,
    startTime,
    partySize,
    bookingTypeName: bookingType.name,
    isEnquiry: false,
    manageToken: booking.manageToken,
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

export interface GuestMatch {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  allergies: string | null;
  staffNotes: string | null;
  visits: number;
  noShows: number;
}

/**
 * Returning guest lookup for the Add booking form: past bookings at this
 * venue whose name, email or phone matches, newest first, one row per
 * guest, merged with any Customer record (tags, allergies, notes).
 */
export async function searchGuests(venueId: string, query: string): Promise<GuestMatch[]> {
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return [];
  const q = query.trim();
  if (q.length < 3) return [];
  const digits = q.replace(/\D/g, "");
  const rows = await prisma.booking.findMany({
    where: {
      venueId,
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ customerPhone: { contains: digits.slice(-6) } }] : []),
      ],
    },
    orderBy: { date: "desc" },
    take: 60,
    select: { customerName: true, customerEmail: true, customerPhone: true, status: true },
  });
  const byKey = new Map<string, GuestMatch>();
  for (const r of rows) {
    const key = (r.customerEmail ?? "").toLowerCase() || (r.customerPhone ?? "").replace(/\s+/g, "") || r.customerName.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      if (r.status === "COMPLETED" || r.status === "CONFIRMED") existing.visits++;
      if (r.status === "NO_SHOW") existing.noShows++;
      continue;
    }
    if (byKey.size >= 6) continue;
    byKey.set(key, {
      key,
      name: r.customerName,
      email: r.customerEmail,
      phone: r.customerPhone,
      tags: [],
      allergies: null,
      staffNotes: null,
      visits: r.status === "COMPLETED" || r.status === "CONFIRMED" ? 1 : 0,
      noShows: r.status === "NO_SHOW" ? 1 : 0,
    });
  }
  const matches = [...byKey.values()];
  const emails = matches.map((m) => m.email?.toLowerCase()).filter((e): e is string => Boolean(e));
  if (emails.length > 0) {
    const customers = await prisma.customer.findMany({
      where: { email: { in: emails } },
      select: { email: true, tags: true, allergies: true, staffNotes: true },
    });
    for (const m of matches) {
      const c = customers.find((x) => x.email === m.email?.toLowerCase());
      if (c) {
        m.tags = c.tags;
        m.allergies = c.allergies;
        m.staffNotes = c.staffNotes;
      }
    }
  }
  return matches;
}
