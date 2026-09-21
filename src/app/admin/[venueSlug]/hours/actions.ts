"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Stored as plain "HH:mm", always within a single 00:00-23:59 day,
 * lifeandsoul-bookings' availability engine (toOvernightSafeRange in
 * opening-window.ts) is what interprets closesAt <= opensAt as "past
 * midnight" and adds the +24h when generating slots, so the admin form
 * doesn't need any overnight-specific input, just two ordinary time fields.
 * DV8's real Fri/Sat hours (12:00-02:00) are entered exactly like that.
 */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * TimeFieldSelect (components/time-field-select.tsx) submits a time as two
 * fields, `${name}-hour` and `${name}-minute`, rather than one native
 * <input type="time"> - see that component's doc comment for why (a real
 * Safari bug where typed 24-hour times didn't register before submit).
 * An empty hour means nothing was picked at all (only meaningful where
 * `optional` is true) - the minute is ignored in that case, so a blank
 * hour with a leftover default minute still reads as "not entered".
 */
function composeTime(formData: FormData, name: string): string {
  const hour = String(formData.get(`${name}-hour`) ?? "").trim();
  if (!hour) return "";
  const minute = String(formData.get(`${name}-minute`) ?? "").trim();
  return `${hour}:${minute}`;
}

/**
 * DateFieldSelect (components/date-field-select.tsx) submits a date as
 * three fields, `${name}-day`/`${name}-month`/`${name}-year`, rather than
 * one native <input type="date"> - see that component's doc comment for
 * why (the matching Safari bug to TimeFieldSelect's, on dates instead of
 * times). Empty if any part is missing, same "incomplete means not
 * entered" contract as composeTime.
 */
function composeDate(formData: FormData, name: string): string {
  const day = String(formData.get(`${name}-day`) ?? "").trim();
  const month = String(formData.get(`${name}-month`) ?? "").trim();
  const year = String(formData.get(`${name}-year`) ?? "").trim();
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day}`;
}

/**
 * venueId now arrives via a hidden form field (set from the page's route
 * param), not the session, admin sessions are venue-independent, see
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
  const openDays: { day: number; opensAt: string; closesAt: string; mode: "OPEN" | "PRIVATE_HIRE_ONLY" }[] = [];

  for (const day of DAYS) {
    // Three states per day now: closed, open, or private hire only - see
    // OpeningHoursMode's doc comment in schema.prisma. `state-${day}` is a
    // <select>, not a checkbox, so an absent/unrecognised value still reads
    // as closed, matching the old checkbox's "absent means closed" default.
    const state = String(formData.get(`state-${day}`) ?? "closed");
    if (state !== "open" && state !== "private_hire_only") {
      closedDays.push(day);
      continue;
    }
    const opensAt = composeTime(formData, `opensAt-${day}`);
    const closesAt = composeTime(formData, `closesAt-${day}`);
    if (!TIME_RE.test(opensAt) || !TIME_RE.test(closesAt)) {
      return { error: `Invalid opening hours for ${DAY_NAME(day)}: "${opensAt}"–"${closesAt}". Use HH:mm, e.g. 09:00.` };
    }
    openDays.push({ day, opensAt, closesAt, mode: state === "private_hire_only" ? "PRIVATE_HIRE_ONLY" : "OPEN" });
  }

  await prisma.$transaction([
    prisma.openingHours.deleteMany({ where: { venueId: venue.id, dayOfWeek: { in: closedDays } } }),
    ...openDays.map(({ day, opensAt, closesAt, mode }) =>
      prisma.openingHours.upsert({
        where: { venueId_dayOfWeek: { venueId: venue.id, dayOfWeek: day } },
        create: { venueId: venue.id, dayOfWeek: day, opensAt, closesAt, mode },
        update: { opensAt, closesAt, mode },
      }),
    ),
  ]);

  revalidatePath(`/admin/${venue.slug}/hours`);
}

function DAY_NAME(day: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
}

/**
 * Special dates and blocked periods used to be two separate models
 * (OpeningHoursException / OpeningHoursBlock) with two separate admin
 * sections. Merged into one OpeningHoursOverride model and one form, see
 * that model's doc comment in schema.prisma for the full composition
 * rules. Field order matches Andy's spec exactly: Start date, End date,
 * Can book, Start time, End time, Note.
 *
 * "Can book" checked = special/altered hours for the whole [dateFrom,
 * dateTo] range, replacing the normal weekly hours, start/end time
 * required. "Can book" unchecked with both times blank = the whole range
 * closed outright. "Can book" unchecked with both times filled = a
 * partial-day block *within* an otherwise-open range (a private event
 * 14:00-18:00 while the rest of the day stays bookable), this is the
 * "keep partial-day blocking too" case, so unlike the old exception form,
 * unchecking "Can book" here doesn't grey the time fields out, it just
 * changes what they mean.
 */
export async function addOverride(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const dateFromStr = composeDate(formData, "dateFrom");
  const dateToStr = composeDate(formData, "dateTo");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(dateToStr)) {
    return { error: "Choose a full start date and end date (day, month and year)." };
  }
  const dateFrom = new Date(`${dateFromStr}T00:00:00.000Z`);
  const dateTo = new Date(`${dateToStr}T00:00:00.000Z`);
  if (dateTo < dateFrom) {
    return { error: "End date must be on or after start date." };
  }

  const canBook = formData.get("canBook") === "on";
  const note = String(formData.get("note") ?? "").trim() || null;
  // Only meaningful when canBook is true, see OpeningHoursOverride.mode's
  // doc comment in schema.prisma - stored as plain OPEN on a canBook=false
  // row regardless of what the select was left on, since it's ignored there.
  const mode = canBook && formData.get("mode") === "PRIVATE_HIRE_ONLY" ? "PRIVATE_HIRE_ONLY" : "OPEN";

  const startTimeRaw = composeTime(formData, "startTime");
  const endTimeRaw = composeTime(formData, "endTime");
  const hasStart = startTimeRaw !== "";
  const hasEnd = endTimeRaw !== "";

  let startTime: string | null = null;
  let endTime: string | null = null;

  if (canBook) {
    // Special/altered hours: times are how this row does anything at all,
    // so they're required, same as the old "Closed all day" unchecked case.
    if (!TIME_RE.test(startTimeRaw) || !TIME_RE.test(endTimeRaw)) {
      return { error: `Special hours need both a start and end time. Got "${startTimeRaw}"–"${endTimeRaw}".` };
    }
    startTime = startTimeRaw;
    endTime = endTimeRaw;
  } else if (hasStart || hasEnd) {
    // Partial-day block: both-or-neither, and (unlike special hours) never
    // allowed to wrap past midnight, it's a carve-out *within* a day's
    // existing window, not a closing time.
    if (!TIME_RE.test(startTimeRaw) || !TIME_RE.test(endTimeRaw)) {
      return { error: `A blocked window needs both a start and end time. Got "${startTimeRaw}"–"${endTimeRaw}".` };
    }
    if (endTimeRaw <= startTimeRaw) {
      return { error: "A blocked period's end time must be after its start time." };
    }
    startTime = startTimeRaw;
    endTime = endTimeRaw;
  }
  // else: canBook is false and both times are blank -> whole range closed.

  await prisma.openingHoursOverride.create({
    data: { venueId: venue.id, dateFrom, dateTo, canBook, mode, startTime, endTime, note },
  });
  revalidatePath(`/admin/${venue.slug}/hours`);
}

export async function deleteOverride(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const id = String(formData.get("id") ?? "");
  await prisma.openingHoursOverride.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/hours`);
}
