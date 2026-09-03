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

export async function saveWeeklyHours(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();

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
    prisma.openingHours.deleteMany({ where: { venueId: session.venueId, dayOfWeek: { in: closedDays } } }),
    ...openDays.map(({ day, opensAt, closesAt }) =>
      prisma.openingHours.upsert({
        where: { venueId_dayOfWeek: { venueId: session.venueId, dayOfWeek: day } },
        create: { venueId: session.venueId, dayOfWeek: day, opensAt, closesAt },
        update: { opensAt, closesAt },
      }),
    ),
  ]);

  revalidatePath("/admin/hours");
}

function DAY_NAME(day: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
}

export async function addException(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();

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
    where: { venueId_date: { venueId: session.venueId, date } },
    create: { venueId: session.venueId, date, isClosed, opensAt, closesAt, note },
    update: { isClosed, opensAt, closesAt, note },
  });
  revalidatePath("/admin/hours");
}

export async function deleteException(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  // deleteMany (not delete) so this can never throw/leak whether an id
  // belonging to another venue exists — scoping by venueId here is what
  // stops one venue's OWNER deleting another venue's exception by guessing
  // an id, the same property the read-only staff query has.
  await prisma.openingHoursException.deleteMany({ where: { id, venueId: session.venueId } });
  revalidatePath("/admin/hours");
}
