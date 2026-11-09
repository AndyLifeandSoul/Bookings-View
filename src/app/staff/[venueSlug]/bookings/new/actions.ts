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
import { computeTableAvailability, type TableAvailabilityInfo } from "@/lib/staff/recommend-tables";

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

export type { TableAvailabilityInfo } from "@/lib/staff/recommend-tables";

/** The "Add booking" form's live table picker, see computeTableAvailability. */
export async function getTableAvailability(params: {
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingTypeId: string;
  partySize: number;
}): Promise<TableAvailabilityInfo> {
  const access = await requireVenueAccess(params.venueId);
  if ("error" in access) return { unavailableTableIds: [], recommendedTableIds: [] };
  return computeTableAvailability(params);
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
