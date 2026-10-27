"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import type { ActionResult } from "@/components/action-form";

async function access(venueId: string) {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Not signed in." } as const;
  if (session.role === "STAFF" && session.venueId !== venueId) return { error: "That venue isn't yours." } as const;
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return { error: "Unknown venue." } as const;
  return { session, venue };
}

/** Puts a name on the door list for a night. */
export async function addGuestListEntry(formData: FormData): Promise<ActionResult> {
  const a = await access(String(formData.get("venueId") ?? ""));
  if ("error" in a) return { error: a.error };
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the night." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Add the name to look for on the door." };
  const guests = Number(formData.get("guests") ?? 1);
  if (!Number.isInteger(guests) || guests < 1 || guests > 200) return { error: "Guests should be a number from 1 to 200." };
  const arriveBy = String(formData.get("arriveBy") ?? "").trim();
  if (arriveBy && !/^\d{2}:\d{2}$/.test(arriveBy)) return { error: "Arrive by should be a time like 23:00." };
  await prisma.guestListEntry.create({
    data: {
      venueId: a.venue.id,
      date: new Date(`${date}T00:00:00.000Z`),
      name,
      guests,
      phone: String(formData.get("phone") ?? "").trim().slice(0, 30) || null,
      arriveBy: arriveBy || null,
      note: String(formData.get("note") ?? "").trim().slice(0, 200) || null,
      addedBy: a.session.name,
    },
  });
  revalidatePath(`/staff/${a.venue.slug}/guest-list`);
}

/** Door actions: count people in (or back out), mark a no-show, or take someone off. */
export async function updateGuestListEntry(formData: FormData): Promise<ActionResult> {
  const a = await access(String(formData.get("venueId") ?? ""));
  if ("error" in a) return { error: a.error };
  const id = String(formData.get("id") ?? "");
  const entry = await prisma.guestListEntry.findFirst({ where: { id, venueId: a.venue.id } });
  if (!entry) return { error: "That name isn't on the list any more." };
  const op = String(formData.get("op") ?? "");
  if (op === "in" || op === "out" || op === "all") {
    const arrived = op === "all" ? entry.guests : Math.max(0, Math.min(entry.guests + 20, entry.arrivedCount + (op === "in" ? 1 : -1)));
    await prisma.guestListEntry.update({ where: { id }, data: { arrivedCount: arrived, status: arrived > 0 ? "ARRIVED" : "LISTED" } });
  } else if (op === "noshow") {
    await prisma.guestListEntry.update({ where: { id }, data: { status: "NO_SHOW", arrivedCount: 0 } });
  } else if (op === "cancel") {
    await prisma.guestListEntry.update({ where: { id }, data: { status: "CANCELLED" } });
  } else if (op === "restore") {
    await prisma.guestListEntry.update({ where: { id }, data: { status: entry.arrivedCount > 0 ? "ARRIVED" : "LISTED" } });
  } else {
    return { error: "Unknown action." };
  }
  revalidatePath(`/staff/${a.venue.slug}/guest-list`);
}
