"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";
import type { DepositType, TableFillMode } from "@/generated/prisma";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEPOSIT_TYPES: DepositType[] = ["NONE", "FIXED", "PER_HEAD"];
const TABLE_FILL_MODES: TableFillMode[] = ["PER_BOOKING", "WHOLE_AREA", "WHOLE_VENUE"];

interface ParsedFields {
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  minPartySize: number;
  maxPartySize: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  durationStepMinutes: number;
  startTimeStepMinutes: number;
  depositType: DepositType;
  depositAmount: number | null;
  requiresPreOrder: boolean;
  enquiryThresholdPartySize: number | null;
  color: string | null;
  runsUntilClose: boolean;
  earliestBookingTime: string | null;
  latestBookingTime: string | null;
  availableDaysOfWeek: number[];
  tableFillMode: TableFillMode;
}

type ParseResult = { ok: true; fields: ParsedFields } | { ok: false; error: string };

/** venueId comes from a hidden form field (set from the page's route param), admin sessions are venue-independent, see requireAdminVenue(). */
async function resolveVenue(formData: FormData): Promise<{ id: string; slug: string } | { error: string }> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  if (!venueId) return { error: "Missing venue." };
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return { error: "Unknown venue." };
  return venue;
}

/** Shared by create and update. Returns a discriminated union rather than throwing, see ActionForm's doc comment for why. */
function parseFields(formData: FormData): ParseResult {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };

  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: `Slug "${slug}" must be lowercase letters, numbers, and hyphens only, e.g. "standard-dining".`,
    };
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const sortOrderRaw = Number(formData.get("sortOrder") ?? 0);
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;

  const minPartySize = Number(formData.get("minPartySize"));
  const maxPartySize = Number(formData.get("maxPartySize"));
  if (
    !Number.isFinite(minPartySize) ||
    !Number.isFinite(maxPartySize) ||
    minPartySize < 1 ||
    maxPartySize < minPartySize
  ) {
    return { ok: false, error: "Party size range is invalid: max must be at least min, and min at least 1." };
  }

  const minDurationMinutes = Number(formData.get("minDurationMinutes"));
  const maxDurationMinutes = Number(formData.get("maxDurationMinutes"));
  if (
    !Number.isFinite(minDurationMinutes) ||
    !Number.isFinite(maxDurationMinutes) ||
    minDurationMinutes < 15 ||
    maxDurationMinutes < minDurationMinutes
  ) {
    return { ok: false, error: "Duration range is invalid: max must be at least min, and min at least 15 minutes." };
  }

  const durationStepMinutes = Number(formData.get("durationStepMinutes") ?? 30);
  const startTimeStepMinutes = Number(formData.get("startTimeStepMinutes") ?? 15);
  if (!Number.isFinite(durationStepMinutes) || durationStepMinutes < 5) {
    return { ok: false, error: "Duration step must be at least 5 minutes." };
  }
  if (!Number.isFinite(startTimeStepMinutes) || startTimeStepMinutes < 5) {
    return { ok: false, error: "Start time step must be at least 5 minutes." };
  }

  const depositTypeRaw = String(formData.get("depositType") ?? "NONE");
  if (!DEPOSIT_TYPES.includes(depositTypeRaw as DepositType)) {
    return { ok: false, error: `Invalid deposit type: "${depositTypeRaw}"` };
  }
  const depositType = depositTypeRaw as DepositType;

  let depositAmount: number | null = null;
  if (depositType !== "NONE") {
    const pounds = Number(formData.get("depositAmountPounds"));
    if (!Number.isFinite(pounds) || pounds <= 0) {
      return { ok: false, error: "Enter a deposit amount greater than £0 for this deposit type." };
    }
    depositAmount = Math.round(pounds * 100);
  }

  const requiresPreOrder = formData.get("requiresPreOrder") === "on";

  const enquiryThresholdRaw = String(formData.get("enquiryThresholdPartySize") ?? "").trim();
  let enquiryThresholdPartySize: number | null = null;
  if (enquiryThresholdRaw !== "") {
    const parsed = Number(enquiryThresholdRaw);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return { ok: false, error: "Enquiry threshold must be a positive number of guests, or left blank." };
    }
    if (parsed > maxPartySize) {
      return {
        ok: false,
        error: "Enquiry threshold can't be above the type's max party size. Nothing would ever exceed it.",
      };
    }
    enquiryThresholdPartySize = parsed;
  }

  const colorRaw = String(formData.get("color") ?? "").trim();
  if (colorRaw && !/^#[0-9a-fA-F]{6}$/.test(colorRaw)) {
    return { ok: false, error: `"${colorRaw}" isn't a valid colour.` };
  }
  const color = colorRaw || null;

  const runsUntilClose = formData.get("runsUntilClose") === "on";

  const TIME_RE = /^\d{1,2}:\d{2}$/;
  const earliestBookingTimeRaw = String(formData.get("earliestBookingTime") ?? "").trim();
  if (earliestBookingTimeRaw && !TIME_RE.test(earliestBookingTimeRaw)) {
    return { ok: false, error: "Earliest booking time isn't a valid time." };
  }
  const earliestBookingTime = earliestBookingTimeRaw || null;
  const latestBookingTimeRaw = String(formData.get("latestBookingTime") ?? "").trim();
  if (latestBookingTimeRaw && !TIME_RE.test(latestBookingTimeRaw)) {
    return { ok: false, error: "Latest booking time isn't a valid time." };
  }
  const latestBookingTime = latestBookingTimeRaw || null;
  if (earliestBookingTime && latestBookingTime && earliestBookingTime > latestBookingTime) {
    return { ok: false, error: "Earliest booking time must be before latest booking time." };
  }

  const availableDaysOfWeek = formData
    .getAll("availableDaysOfWeek")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  const tableFillModeRaw = String(formData.get("tableFillMode") ?? "PER_BOOKING");
  if (!TABLE_FILL_MODES.includes(tableFillModeRaw as TableFillMode)) {
    return { ok: false, error: `Invalid table fill mode: "${tableFillModeRaw}"` };
  }
  const tableFillMode = tableFillModeRaw as TableFillMode;

  return {
    ok: true,
    fields: {
      name,
      slug,
      description,
      active,
      sortOrder,
      minPartySize,
      maxPartySize,
      minDurationMinutes,
      maxDurationMinutes,
      durationStepMinutes,
      startTimeStepMinutes,
      depositType,
      depositAmount,
      requiresPreOrder,
      enquiryThresholdPartySize,
      color,
      runsUntilClose,
      earliestBookingTime,
      latestBookingTime,
      availableDaysOfWeek,
      tableFillMode,
    },
  };
}

/**
 * Reads the area_<id>_selected/area_<id>_priority pairs booking-type-fields
 * renders per venue area (see that file) and validates each priority, one
 * lookup per area rather than parallel array fields, so selection and
 * priority can never get out of sync by index.
 */
async function parseAreaPriorities(
  formData: FormData,
  venueId: string,
): Promise<{ ok: true; rows: { areaId: string; priority: number }[] } | { ok: false; error: string }> {
  const areas = await prisma.area.findMany({ where: { venueId }, select: { id: true } });
  const rows: { areaId: string; priority: number }[] = [];
  for (const area of areas) {
    if (formData.get(`area_${area.id}_selected`) !== "on") continue;
    const priorityRaw = Number(formData.get(`area_${area.id}_priority`) ?? 0);
    if (!Number.isFinite(priorityRaw)) return { ok: false, error: "Area priority must be a number." };
    rows.push({ areaId: area.id, priority: Math.trunc(priorityRaw) });
  }
  return { ok: true, rows };
}

/**
 * Parses and validates the "Date override" rows, see DateOverrideField.
 * The field names are parallel arrays (one entry per row, in the same
 * order the rows were rendered). Every field submits exactly one value per
 * row, including "Can book" - that one is a checkbox in the UI but rides
 * on an always-present hidden input under the hood (see DateOverrideField's
 * doc comment), specifically so it can't silently drop out of index
 * alignment with the others the way a bare unchecked checkbox would.
 */
function parseDateOverrides(formData: FormData):
  | { ok: true; rows: { dateFrom: Date; dateTo: Date; startTime: string | null; endTime: string | null; allow: boolean; note: string | null }[] }
  | { ok: false; error: string } {
  const dateFroms = formData.getAll("dateOverrideDateFrom").map(String);
  const dateTos = formData.getAll("dateOverrideDateTo").map(String);
  const startTimes = formData.getAll("dateOverrideStartTime").map(String);
  const endTimes = formData.getAll("dateOverrideEndTime").map(String);
  const canBooks = formData.getAll("dateOverrideCanBook").map(String);
  const notes = formData.getAll("dateOverrideNote").map(String);

  const rows: { dateFrom: Date; dateTo: Date; startTime: string | null; endTime: string | null; allow: boolean; note: string | null }[] = [];
  for (let i = 0; i < dateFroms.length; i++) {
    const dateFromStr = dateFroms[i];
    const dateToStr = dateTos[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(dateToStr)) {
      return { ok: false, error: `"${dateFromStr}" - "${dateToStr}" isn't a valid date range.` };
    }
    const dateFrom = new Date(`${dateFromStr}T00:00:00.000Z`);
    const dateTo = new Date(`${dateToStr}T00:00:00.000Z`);
    if (dateTo < dateFrom) {
      return { ok: false, error: `Date override ${dateFromStr} - ${dateToStr}: end date must be on or after start date.` };
    }
    const startTime = startTimes[i]?.trim() || null;
    const endTime = endTimes[i]?.trim() || null;
    if ((startTime == null) !== (endTime == null)) {
      return { ok: false, error: `Date override ${dateFromStr} - ${dateToStr}: set both a start and end time, or leave both blank.` };
    }
    const note = notes[i]?.trim() || null;
    rows.push({ dateFrom, dateTo, startTime, endTime, allow: canBooks[i] === "on", note });
  }
  return { ok: true, rows };
}

export async function createBookingType(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const parsed = parseFields(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { fields } = parsed;
  const areaPriorities = await parseAreaPriorities(formData, venue.id);
  if (!areaPriorities.ok) return { error: areaPriorities.error };
  const dateOverrides = parseDateOverrides(formData);
  if (!dateOverrides.ok) return { error: dateOverrides.error };

  const existing = await prisma.bookingType.findUnique({
    where: { venueId_slug: { venueId: venue.id, slug: fields.slug } },
  });
  if (existing) {
    return { error: `A booking type with slug "${fields.slug}" already exists for this venue.` };
  }

  await prisma.bookingType.create({
    data: {
      venueId: venue.id,
      ...fields,
      areaPriorities: { createMany: { data: areaPriorities.rows } },
      dateOverrides: { createMany: { data: dateOverrides.rows } },
    },
  });
  revalidatePath(`/admin/${venue.slug}/booking-types`);
  redirect(`/admin/${venue.slug}/booking-types`);
}

export async function updateBookingType(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const parsed = parseFields(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { fields } = parsed;
  const areaPriorities = await parseAreaPriorities(formData, venue.id);
  if (!areaPriorities.ok) return { error: areaPriorities.error };
  const dateOverrides = parseDateOverrides(formData);
  if (!dateOverrides.ok) return { error: dateOverrides.error };

  const existing = await prisma.bookingType.findUnique({
    where: { venueId_slug: { venueId: venue.id, slug: fields.slug } },
  });
  if (existing && existing.id !== id) {
    return { error: `A booking type with slug "${fields.slug}" already exists for this venue.` };
  }

  const owned = await prisma.bookingType.findFirst({ where: { id, venueId: venue.id }, select: { id: true } });
  if (!owned) return { error: "Booking type not found for this venue." };

  // Whole-row replace for both join tables, in the same transaction as the
  // scalar update, simpler and safer than diffing old vs. new rows, and
  // these tables are small (a handful of areas/overrides per booking type
  // at most).
  await prisma.$transaction([
    prisma.bookingType.updateMany({ where: { id, venueId: venue.id }, data: fields }),
    prisma.bookingTypeArea.deleteMany({ where: { bookingTypeId: id } }),
    ...(areaPriorities.rows.length > 0
      ? [prisma.bookingTypeArea.createMany({ data: areaPriorities.rows.map((r) => ({ ...r, bookingTypeId: id })) })]
      : []),
    prisma.bookingTypeDateOverride.deleteMany({ where: { bookingTypeId: id } }),
    ...(dateOverrides.rows.length > 0
      ? [
          prisma.bookingTypeDateOverride.createMany({
            data: dateOverrides.rows.map((r) => ({ ...r, bookingTypeId: id })),
          }),
        ]
      : []),
  ]);

  revalidatePath(`/admin/${venue.slug}/booking-types`);
  redirect(`/admin/${venue.slug}/booking-types`);
}

export async function deleteBookingType(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

  const bookingType = await prisma.bookingType.findFirst({
    where: { id, venueId: venue.id },
    select: { name: true },
  });
  if (!bookingType) return { error: "Booking type not found for this venue." };

  const bookingCount = await prisma.booking.count({ where: { bookingTypeId: id } });
  if (bookingCount > 0) {
    // Real bookings reference this row, hard-deleting would either fail on
    // the FK or, worse, cascade and destroy booking history. Deactivating
    // is the only safe path once a type has ever been used.
    await prisma.bookingType.updateMany({ where: { id, venueId: venue.id }, data: { active: false } });
    revalidatePath(`/admin/${venue.slug}/booking-types`);
    return {
      error: `"${bookingType.name}" has ${bookingCount} booking(s) against it, so it can't be deleted. It's been deactivated instead.`,
    };
  }

  await prisma.bookingType.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/booking-types`);
}
