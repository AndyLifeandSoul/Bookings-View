"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Stored as plain "HH:mm", always within a single 00:00-23:59 day —
 * lifeandsoul-bookings' availability engine (toOvernightSafeRange in
 * opening-window.ts) is what interprets closesAt <= opensAt as "past
 * midnight" and adds the +24h when generating slots, so the admin form
 * doesn't need any overnight-specific input, just two ordinary time fields.
 * DV8's real Fri/Sat hours (12:00-02:00) are entered exactly like that.
 */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * venueId now arrives via a hidden form field (set from the page's route
 * param), not the session — admin sessions are venue-independent, see
 * requireAdminVenue(). requireAdminSession() (called by every action below)
 * still enforces that only OWNER/MANAGER reach any of this at all; unlike
 * the old session.venueId scoping, there's no per-venue ownership check to
 * add on top for those roles, since they're allowed to edit any venue by
 * design (task: "admin logins ... shouldn't be tied to any specific venue").
 */
async function resolveVenue(formData: FormData): Promise<{ id: string; slug: string } | { error: string }> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  if (!venueId) return { error: "Missing venue." };
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return { error: "Unknown venue." };
  return venue;
}

export async function saveWeeklyHours(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const closedDays: number[] = [];
  const openDays: { day: number; opensAt: string; closesAt: string }[] = [];

  for (const day of DAYS) {
    if (formData.get(`closed-${day}`) === "on") {
      closedDays.push(day);
      continue;
    }
    const opensAt = String(formData.get(`opensAt-${day}`) ?? "").trim();
    const closesAt = String(formData.get(`closesAt-${day}`) ?? "").trim();
    if (!TIME_RE.test(opensAt) || !TIME_RE.test(closesAt)) {
      return { error: `Invalid opening hours for ${DAY_NAME(day)}: "${opensAt}"–"${closesAt}". Use HH:mm, e.g. 09:00.` };
    }
    openDays.push({ day, opensAt, closesAt });
  }

  await prisma.$transaction([
    prisma.openingHours.deleteMany({ where: { venueId: venue.id, dayOfWeek: { in: closedDays } } }),
    ...openDays.map(({ day, opensAt, closesAt }) =>
      prisma.openingHours.upsert({
        where: { venueId_dayOfWeek: { venueId: venue.id, dayOfWeek: day } },
        create: { venueId: venue.id, dayOfWeek: day, opensAt, closesAt },
        update: { opensAt, closesAt },
      }),
    ),
  ]);

  revalidatePath(`/admin/${venue.slug}/hours`);
}

function DAY_NAME(day: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
}

export async function addException(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const dateStr = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { error: `Invalid date: "${dateStr}"` };
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const isClosed = formData.get("isClosed") === "on";
  const note = String(formData.get("note") ?? "").trim() || null;

  let opensAt: string | null = null;
  let closesAt: string | null = null;
  if (!isClosed) {
    opensAt = String(formData.get("opensAt") ?? "").trim();
    closesAt = String(formData.get("closesAt") ?? "").trim();
    if (!TIME_RE.test(opensAt) || !TIME_RE.test(closesAt)) {
      return { error: `Invalid special hours: "${opensAt}"–"${closesAt}". Use HH:mm, e.g. 18:00.` };
    }
  }

  await prisma.openingHoursException.upsert({
    where: { venueId_date: { venueId: venue.id, date } },
    create: { venueId: venue.id, date, isClosed, opensAt, closesAt, note },
    update: { isClosed, opensAt, closesAt, note },
  });
  revalidatePath(`/admin/${venue.slug}/hours`);
}

export async function deleteException(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const id = String(formData.get("id") ?? "");
  await prisma.openingHoursException.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/hours`);
}

export async function addOpeningHoursBlock(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const dateStr = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { error: `Invalid date: "${dateStr}"` };
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  if (!TIME_RE.test(startsAt) || !TIME_RE.test(endsAt)) {
    return { error: `Invalid block times: "${startsAt}"–"${endsAt}". Use HH:mm, e.g. 14:00.` };
  }
  if (endsAt <= startsAt) {
    // Unlike weekly hours/exceptions, a block is never allowed to be an
    // overnight range — it's a carve-out *within* a day's existing window
    // (see OpeningHoursBlock's doc comment in schema.prisma), so it can't
    // wrap past midnight the way a venue's actual closing time can.
    return { error: "A blocked period's end time must be after its start time." };
  }
  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.openingHoursBlock.create({ data: { venueId: venue.id, date, startsAt, endsAt, note } });
  revalidatePath(`/admin/${venue.slug}/hours`);
}

export async function deleteOpeningHoursBlock(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const id = String(formData.get("id") ?? "");
  await prisma.openingHoursBlock.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/hours`);
}
