"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";
import type { DepositType } from "@/generated/prisma";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEPOSIT_TYPES: DepositType[] = ["NONE", "FIXED", "PER_HEAD"];

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
}

type ParseResult = { ok: true; fields: ParsedFields } | { ok: false; error: string };

/** venueId comes from a hidden form field (set from the page's route param) — admin sessions are venue-independent, see requireAdminVenue(). */
async function resolveVenue(formData: FormData): Promise<{ id: string; slug: string } | { error: string }> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  if (!venueId) return { error: "Missing venue." };
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return { error: "Unknown venue." };
  return venue;
}

/** Shared by create and update. Returns a discriminated union rather than throwing — see ActionForm's doc comment for why. */
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
    return { ok: false, error: "Party size range is invalid — max must be at least min, and min at least 1." };
  }

  const minDurationMinutes = Number(formData.get("minDurationMinutes"));
  const maxDurationMinutes = Number(formData.get("maxDurationMinutes"));
  if (
    !Number.isFinite(minDurationMinutes) ||
    !Number.isFinite(maxDurationMinutes) ||
    minDurationMinutes < 15 ||
    maxDurationMinutes < minDurationMinutes
  ) {
    return { ok: false, error: "Duration range is invalid — max must be at least min, and min at least 15 minutes." };
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
        error: "Enquiry threshold can't be above the type's max party size — nothing would ever exceed it.",
      };
    }
    enquiryThresholdPartySize = parsed;
  }

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
    },
  };
}

export async function createBookingType(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const parsed = parseFields(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { fields } = parsed;

  const existing = await prisma.bookingType.findUnique({
    where: { venueId_slug: { venueId: venue.id, slug: fields.slug } },
  });
  if (existing) {
    return { error: `A booking type with slug "${fields.slug}" already exists for this venue.` };
  }

  await prisma.bookingType.create({ data: { venueId: venue.id, ...fields } });
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

  const existing = await prisma.bookingType.findUnique({
    where: { venueId_slug: { venueId: venue.id, slug: fields.slug } },
  });
  if (existing && existing.id !== id) {
    return { error: `A booking type with slug "${fields.slug}" already exists for this venue.` };
  }

  // updateMany + venueId, not update(where: {id}) — keeps this a no-op
  // rather than a cross-venue write if the hidden venueId field and the id
  // ever disagree (e.g. a stale form left open after switching venues).
  const result = await prisma.bookingType.updateMany({
    where: { id, venueId: venue.id },
    data: fields,
  });
  if (result.count === 0) {
    return { error: "Booking type not found for this venue." };
  }

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
    // Real bookings reference this row — hard-deleting would either fail on
    // the FK or, worse, cascade and destroy booking history. Deactivating
    // is the only safe path once a type has ever been used.
    await prisma.bookingType.updateMany({ where: { id, venueId: venue.id }, data: { active: false } });
    revalidatePath(`/admin/${venue.slug}/booking-types`);
    return {
      error: `"${bookingType.name}" has ${bookingCount} booking(s) against it, so it can't be deleted — deactivated instead.`,
    };
  }

  await prisma.bookingType.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/booking-types`);
}
