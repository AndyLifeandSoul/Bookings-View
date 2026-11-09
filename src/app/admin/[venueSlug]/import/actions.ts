"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { readBookingsCsv, matchBookingType, type ImportRow } from "@/lib/import/bookings-csv";
import { computeTableAvailability } from "@/lib/staff/recommend-tables";
import { logBookingEvent } from "@/lib/bookings/events";
import { formatMinutes, toMinutes } from "@/lib/bookings/time";

const MAX_BYTES = 5 * 1024 * 1024;

/** Today in London, as the booking dates in the file are venue-local days. */
function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export interface PreviewRow {
  line: number;
  ref: string | null;
  name: string;
  dateStr: string | null;
  startTime: string | null;
  partySize: number | null;
  typeName: string;
  status: string | null;
  notes: string | null;
  skip: string | null;
}

export type PreviewResult =
  | { error: string }
  | {
      rows: PreviewRow[];
      types: { name: string; count: number; matchedId: string | null }[];
      bookingTypes: { id: string; name: string }[];
      toImport: number;
    };

async function readFile(venueSlug: string, text: string) {
  const { venue, session } = await requireAdminVenue(venueSlug);
  if (text.length > MAX_BYTES) throw new Error("That file is too big. Split it into smaller files of under 5MB.");
  const parsed = readBookingsCsv(text, londonToday());
  const refs = parsed.rows.map((r) => r.ref).filter((r): r is string => !!r);
  const existing = refs.length
    ? new Set((await prisma.booking.findMany({ where: { bookingRef: { in: refs } }, select: { bookingRef: true } })).map((b) => b.bookingRef))
    : new Set<string | null>();
  for (const r of parsed.rows) if (!r.skip && r.ref && existing.has(r.ref)) r.skip = "Already imported";
  const bookingTypes = await prisma.bookingType.findMany({
    where: { venueId: venue.id },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, minDurationMinutes: true },
  });
  return { venue, session, parsed, bookingTypes };
}

/** Reads the file and shows what would happen, without saving anything. */
export async function previewBookingsImport(venueSlug: string, text: string): Promise<PreviewResult> {
  try {
    const { parsed, bookingTypes } = await readFile(venueSlug, text);
    if (parsed.problems.length) return { error: `This file can't be imported: ${parsed.problems.join(" ")}` };
    const counts = new Map<string, number>();
    for (const r of parsed.rows) if (!r.skip) counts.set(r.typeName, (counts.get(r.typeName) ?? 0) + 1);
    return {
      // Soonest first, with rows that have no usable date at the end.
      rows: [...parsed.rows].sort((a, b) => `${a.dateStr ?? "9"}${a.startTime ?? ""}`.localeCompare(`${b.dateStr ?? "9"}${b.startTime ?? ""}`)).map((r) => ({
        line: r.line, ref: r.ref, name: r.name, dateStr: r.dateStr, startTime: r.startTime, partySize: r.partySize,
        typeName: r.typeName, status: r.status, notes: r.notes, skip: r.skip,
      })),
      types: [...counts].map(([name, count]) => ({ name, count, matchedId: matchBookingType(name, bookingTypes)?.id ?? null })),
      bookingTypes: bookingTypes.map((t) => ({ id: t.id, name: t.name })),
      toImport: parsed.rows.filter((r) => !r.skip).length,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't read that file." };
  }
}

export type ImportResult =
  | { error: string }
  | { imported: number; withTables: number; needTables: { line: number; name: string; dateStr: string; startTime: string; partySize: number }[]; skipped: number };

/**
 * Creates the bookings. No emails go to guests (they already have their
 * booking from the old system). Each one gets the best free table the same
 * way the Add booking form suggests one, in date order, so later rows see
 * the tables earlier rows took; any that don't fit stay unassigned for
 * staff to seat from the diary. The old system's reference is kept as the
 * booking reference, which is also what stops a second import of the same
 * file creating duplicates.
 */
export async function runBookingsImport(venueSlug: string, text: string, typeMap: Record<string, string>): Promise<ImportResult> {
  try {
    const { venue, session, parsed, bookingTypes } = await readFile(venueSlug, text);
    if (parsed.problems.length) return { error: parsed.problems.join(" ") };
    const typeById = new Map(bookingTypes.map((t) => [t.id, t]));

    const rows = parsed.rows
      .filter((r): r is ImportRow & { dateStr: string; startTime: string; partySize: number } => !r.skip && !!r.dateStr && !!r.startTime && !!r.partySize)
      .sort((a, b) => (a.dateStr + a.startTime).localeCompare(b.dateStr + b.startTime));

    let imported = 0;
    let withTables = 0;
    let skipped = parsed.rows.length - rows.length;
    const needTables: { line: number; name: string; dateStr: string; startTime: string; partySize: number }[] = [];

    for (const r of rows) {
      const typeId = typeMap[r.typeName] ?? matchBookingType(r.typeName, bookingTypes)?.id;
      const type = typeId ? typeById.get(typeId) : undefined;
      if (!type) {
        skipped++;
        continue;
      }
      const startTime = r.startTime;
      const endTime = formatMinutes(toMinutes(startTime) + (r.durationMinutes ?? type.minDurationMinutes));
      const date = new Date(`${r.dateStr}T00:00:00.000Z`);

      const { recommendedTableIds } = await computeTableAvailability({
        venueId: venue.id, date: r.dateStr, startTime, endTime, bookingTypeId: type.id, partySize: r.partySize,
      });

      try {
        const booking = await prisma.booking.create({
          data: {
            venueId: venue.id,
            bookingTypeId: type.id,
            bookingRef: r.ref,
            date,
            startTime,
            endTime,
            partySize: r.partySize,
            status: r.status ?? "CONFIRMED",
            source: r.source,
            channel: r.channel,
            manageToken: randomBytes(24).toString("base64url"),
            customerName: r.name,
            customerEmail: r.email,
            customerPhone: r.phone,
            notes: r.notes,
            staffNotes: r.staffNotes,
            takenByStaffName: r.takenBy,
            minSpendPence: r.minSpendPence,
            bookingTables: recommendedTableIds.length ? { create: recommendedTableIds.map((tableId) => ({ tableId })) } : undefined,
          },
          select: { id: true },
        });
        await logBookingEvent({ bookingId: booking.id, actor: session.name, kind: "created", detail: `Imported from another booking system${r.ref ? ` (ref ${r.ref})` : ""}` });
        imported++;
        if (recommendedTableIds.length) withTables++;
        else needTables.push({ line: r.line, name: r.name, dateStr: r.dateStr, startTime, partySize: r.partySize });
      } catch (err) {
        // A reference already used by another booking (imported meanwhile, or
        // the same ref twice in one file) is skipped rather than failing the lot.
        console.error(`Import row ${r.line} failed`, err);
        skipped++;
      }
    }

    revalidatePath(`/staff/${venue.slug}/diary`);
    return { imported, withTables, needTables, skipped };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The import didn't finish." };
  }
}
