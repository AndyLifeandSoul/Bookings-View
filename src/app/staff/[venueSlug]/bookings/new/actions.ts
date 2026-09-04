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
  /** Best-fit available table for this booking type/party size/time, if one exists. Staff still pick tables themselves; this only flags a suggestion. */
  recommendedTableId: string | null;
}

/**
 * Backs the "Add booking" form's live table picker: which tables are
 * already booked for this date/time (greyed out, not selectable), and
 * which available table is the best fit for this booking type and party
 * size (flagged "Recommended"). Deliberately a much simpler heuristic than
 * lifeandsoul-bookings' real assignTables engine - bookings-view doesn't
 * run that engine, this only has to pick one sensible table for a human to
 * confirm or override, not replicate the customer-facing allocation logic
 * exactly. Recommends the tightest-fitting table (smallest maxCovers that
 * still fits partySize) within the booking type's allowed areas (if
 * restricted via areaPriorities), in area-priority order; null if nothing
 * fits (e.g. the party's bigger than any single table - staff combine
 * tables manually for that, same as always).
 */
export async function getTableAvailability(params: {
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingTypeId: string;
  partySize: number;
}): Promise<TableAvailabilityInfo> {
  const empty: TableAvailabilityInfo = { unavailableTableIds: [], recommendedTableId: null };
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

  const conflicts = await findTableConflicts({
    venueId,
    date,
    startTime,
    endTime,
    tableIds: tables.map((t) => t.id),
  });
  const unavailableTableIds = [...new Set(conflicts.map((c) => c.tableId))];
  const unavailableSet = new Set(unavailableTableIds);

  const areaPriority = new Map((bookingType?.areaPriorities ?? []).map((ap) => [ap.areaId, ap.priority]));
  const restrictToAreas = areaPriority.size > 0;

  const candidates = tables.filter((t) => {
    if (unavailableSet.has(t.id)) return false;
    if (restrictToAreas && (!t.areaId || !areaPriority.has(t.areaId))) return false;
    return partySize >= t.minCovers && partySize <= t.maxCovers;
  });

  candidates.sort((a, b) => {
    const aPriority = restrictToAreas ? (areaPriority.get(a.areaId!) ?? 0) : 0;
    const bPriority = restrictToAreas ? (areaPriority.get(b.areaId!) ?? 0) : 0;
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (a.maxCovers !== b.maxCovers) return a.maxCovers - b.maxCovers;
    return a.sortOrder - b.sortOrder;
  });

  return { unavailableTableIds, recommendedTableId: candidates[0]?.id ?? null };
}
