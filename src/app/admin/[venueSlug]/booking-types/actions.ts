"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";
import type { DepositType, TableFillMode } from "@/generated/prisma";

/**
 * Booking types no longer ask staff for a slug (Andy: "why do we ask for
 * these") - it's auto-generated from the name. Slug is still the stable,
 * unique, URL-safe identifier the customer booking flow uses, so it's
 * generated once on create and never changed on rename (changing it would
 * break existing booking links).
 */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "booking-type";
}

async function uniqueSlug(venueId: string, base: string): Promise<string> {
  const existing = await prisma.bookingType.findMany({
    where: { venueId, slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((b) => b.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
const DEPOSIT_TYPES: DepositType[] = ["NONE", "FIXED", "PER_HEAD"];
const TABLE_FILL_MODES: TableFillMode[] = ["PER_BOOKING", "WHOLE_AREA", "WHOLE_VENUE"];

interface ParsedFields {
  name: string;
  description: string | null;
  active: boolean;
  isPrivateHireType: boolean;
  bufferMinutes: number;
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
  preOrderPaymentRequired: boolean;
  preOrderMenuId: string | null;
  preOrderMinItemsPerPerson: number | null;
  preOrderMaxItemsPerPerson: number | null;
  enquiryThresholdPartySize: number | null;
  autoConfirmMinLeadMinutes: number | null;
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

  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const isPrivateHireType = formData.get("isPrivateHireType") === "on";

  const bufferMinutesRaw = String(formData.get("bufferMinutes") ?? "0").trim();
  const bufferMinutes = bufferMinutesRaw === "" ? 0 : Number(bufferMinutesRaw);
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
    return { ok: false, error: "Buffer between bookings must be zero or a positive number of minutes." };
  }
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
  const preOrderPaymentRequired = formData.get("preOrderPaymentRequired") === "on";
  const preOrderMenuId = String(formData.get("preOrderMenuId") ?? "").trim() || null;

  const parseItemBound = (raw: FormDataEntryValue | null): number | null | "invalid" => {
    const v = String(raw ?? "").trim();
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) return "invalid";
    return n;
  };
  const preOrderMinItemsPerPerson = parseItemBound(formData.get("preOrderMinItemsPerPerson"));
  const preOrderMaxItemsPerPerson = parseItemBound(formData.get("preOrderMaxItemsPerPerson"));
  if (preOrderMinItemsPerPerson === "invalid" || preOrderMaxItemsPerPerson === "invalid") {
    return { ok: false, error: "Items per guest must be a whole number (0 or more), or left blank." };
  }
  if (
    preOrderMinItemsPerPerson !== null &&
    preOrderMaxItemsPerPerson !== null &&
    preOrderMinItemsPerPerson > preOrderMaxItemsPerPerson
  ) {
    return { ok: false, error: "Min items per guest can't be more than max items per guest." };
  }

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

  const autoConfirmLeadRaw = String(formData.get("autoConfirmMinLeadMinutes") ?? "").trim();
  let autoConfirmMinLeadMinutes: number | null = null;
  if (autoConfirmLeadRaw !== "") {
    const parsed = Number(autoConfirmLeadRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, error: "Auto-confirm notice must be zero or a positive number of minutes, or left blank." };
    }
    autoConfirmMinLeadMinutes = parsed;
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
      description,
      active,
      isPrivateHireType,
      bufferMinutes,
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
      preOrderPaymentRequired,
      preOrderMenuId,
      preOrderMinItemsPerPerson,
      preOrderMaxItemsPerPerson,
      enquiryThresholdPartySize,
      autoConfirmMinLeadMinutes,
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

/**
 * Parses the optional per-day booking windows (see BookingType.dayWindows).
 * One earliest/latest time pair per weekday; a day with both blank is
 * skipped (that day falls back to the type-level window).
 */
function parseDayWindows(formData: FormData):
  | { ok: true; rows: { dayOfWeek: number; earliestBookingTime: string; latestBookingTime: string }[] }
  | { ok: false; error: string } {
  const rows: { dayOfWeek: number; earliestBookingTime: string; latestBookingTime: string }[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    const e = String(formData.get(`dayWindow_${dow}_earliest`) ?? "").trim();
    const l = String(formData.get(`dayWindow_${dow}_latest`) ?? "").trim();
    if (!e && !l) continue;
    if (!e || !l) return { ok: false, error: "Set both an earliest and latest time for a per-day window, or leave both blank." };
    const timeRe = /^\d{1,2}:\d{2}$/;
    if (!timeRe.test(e) || !timeRe.test(l)) return { ok: false, error: "Per-day window times must be valid times." };
    if (e > l) return { ok: false, error: "A per-day window's earliest time must be before its latest." };
    rows.push({ dayOfWeek: dow, earliestBookingTime: e, latestBookingTime: l });
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
  const dayWindows = parseDayWindows(formData);
  if (!dayWindows.ok) return { error: dayWindows.error };

  const slug = await uniqueSlug(venue.id, slugify(fields.name));

  await prisma.bookingType.create({
    data: {
      venueId: venue.id,
      slug,
      ...fields,
      areaPriorities: { createMany: { data: areaPriorities.rows } },
      dateOverrides: { createMany: { data: dateOverrides.rows } },
      dayWindows: { createMany: { data: dayWindows.rows } },
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
  const dayWindows = parseDayWindows(formData);
  if (!dayWindows.ok) return { error: dayWindows.error };

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
    prisma.bookingTypeDayWindow.deleteMany({ where: { bookingTypeId: id } }),
    ...(dayWindows.rows.length > 0
      ? [prisma.bookingTypeDayWindow.createMany({ data: dayWindows.rows.map((r) => ({ ...r, bookingTypeId: id })) })]
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

/**
 * Persists a new booking-type display order from the drag-to-reorder list
 * (see SortableList). Sets each type's sortOrder to its position in
 * orderedIds; only ids belonging to this venue are touched, so a stray id
 * can't reorder another venue's types. Called directly from the client (not
 * via a form), so it takes plain args rather than FormData.
 */
export async function reorderBookingTypes(venueId: string, orderedIds: string[]): Promise<void> {
  await requireAdminSession();
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return;

  const owned = await prisma.bookingType.findMany({ where: { venueId: venue.id }, select: { id: true } });
  const ownedIds = new Set(owned.map((b) => b.id));

  await prisma.$transaction(
    orderedIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) => prisma.bookingType.update({ where: { id }, data: { sortOrder: index } })),
  );

  revalidatePath(`/admin/${venue.slug}/booking-types`);
}
