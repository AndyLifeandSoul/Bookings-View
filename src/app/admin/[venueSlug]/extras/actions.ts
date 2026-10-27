"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

async function venueFrom(formData: FormData): Promise<{ id: string; slug: string } | { error: string }> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const venue = venueId ? await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } }) : null;
  return venue ?? { error: "Unknown venue." };
}

function readExtra(formData: FormData): { error: string } | { name: string; description: string | null; pricePence: number; perGuest: boolean; active: boolean } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the extra a name." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };
  const price = Number(String(formData.get("pricePounds") ?? "").trim());
  if (!Number.isFinite(price) || price < 0 || price > 10000) return { error: "Enter a price in pounds, like 6.50." };
  const description = String(formData.get("description") ?? "").trim().slice(0, 160) || null;
  return {
    name,
    description,
    pricePence: Math.round(price * 100),
    perGuest: formData.get("perGuest") === "on",
    active: formData.has("active") ? formData.getAll("active").includes("on") : true,
  };
}

async function bookingTypeIds(formData: FormData, venueId: string): Promise<string[]> {
  const ids = formData.getAll("bookingTypeId").map(String);
  if (ids.length === 0) return [];
  const valid = await prisma.bookingType.findMany({ where: { venueId, id: { in: ids } }, select: { id: true } });
  return valid.map((b) => b.id);
}

export async function createExtra(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await venueFrom(formData);
  if ("error" in venue) return venue;
  const fields = readExtra(formData);
  if ("error" in fields) return fields;
  const types = await bookingTypeIds(formData, venue.id);
  const last = await prisma.addOn.aggregate({ where: { venueId: venue.id }, _max: { sortOrder: true } });
  await prisma.addOn.create({
    data: {
      venueId: venue.id,
      ...fields,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
      bookingTypes: { create: types.map((bookingTypeId) => ({ bookingTypeId })) },
    },
  });
  revalidatePath(`/admin/${venue.slug}/extras`);
}

export async function updateExtra(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await venueFrom(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.addOn.findFirst({ where: { id, venueId: venue.id }, select: { id: true } });
  if (!existing) return { error: "That extra no longer exists." };
  const fields = readExtra(formData);
  if ("error" in fields) return fields;
  const types = await bookingTypeIds(formData, venue.id);
  await prisma.$transaction([
    prisma.addOn.update({ where: { id }, data: fields }),
    prisma.addOnBookingType.deleteMany({ where: { addOnId: id } }),
    prisma.addOnBookingType.createMany({ data: types.map((bookingTypeId) => ({ addOnId: id, bookingTypeId })) }),
  ]);
  revalidatePath(`/admin/${venue.slug}/extras`);
}

/** Bookings keep their own copy of the name and price, so deleting an extra never changes a past booking. */
export async function deleteExtra(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await venueFrom(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  await prisma.addOn.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/extras`);
}
