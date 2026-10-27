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

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function readCode(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return { error: "Codes are 3 to 20 letters or numbers, no spaces, like XMAS10." };
  const kind = String(formData.get("kind") ?? "percent");
  const value = Number(String(formData.get("value") ?? "").trim());
  let percentOff: number | null = null;
  let amountOffPence: number | null = null;
  if (kind === "percent") {
    if (!Number.isInteger(value) || value < 1 || value > 100) return { error: "A percentage off is a whole number from 1 to 100." };
    percentOff = value;
  } else {
    if (!Number.isFinite(value) || value <= 0 || value > 10000) return { error: "Enter the amount off in pounds, like 10." };
    amountOffPence = Math.round(value * 100);
  }
  const from = String(formData.get("validFrom") ?? "").trim();
  const to = String(formData.get("validTo") ?? "").trim();
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return { error: "Pick a full date, or leave it blank." };
  if (from && to && to < from) return { error: "The last day is before the first day." };
  const usesRaw = String(formData.get("maxUses") ?? "").trim();
  const maxUses = usesRaw === "" ? null : Number(usesRaw);
  if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1)) return { error: "The use limit is a whole number, or blank for no limit." };
  return {
    code,
    description: String(formData.get("description") ?? "").trim().slice(0, 120) || null,
    percentOff,
    amountOffPence,
    validFrom: from ? new Date(`${from}T00:00:00.000Z`) : null,
    validTo: to ? new Date(`${to}T00:00:00.000Z`) : null,
    maxUses,
  };
}

export async function createOfferCode(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await venueFrom(formData);
  if ("error" in venue) return venue;
  const fields = readCode(formData);
  if ("error" in fields) return { error: fields.error };
  const clash = await prisma.promoCode.findUnique({ where: { venueId_code: { venueId: venue.id, code: fields.code } } });
  if (clash) return { error: `You already have a code called ${fields.code}.` };
  await prisma.promoCode.create({ data: { venueId: venue.id, ...fields } });
  revalidatePath(`/admin/${venue.slug}/offers`);
}

export async function updateOfferCode(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await venueFrom(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.promoCode.findFirst({ where: { id, venueId: venue.id } });
  if (!existing) return { error: "That code no longer exists." };
  const fields = readCode(formData);
  if ("error" in fields) return { error: fields.error };
  if (fields.code !== existing.code) {
    const clash = await prisma.promoCode.findUnique({ where: { venueId_code: { venueId: venue.id, code: fields.code } } });
    if (clash) return { error: `You already have a code called ${fields.code}.` };
  }
  await prisma.promoCode.update({ where: { id }, data: { ...fields, active: formData.getAll("active").includes("on") } });
  revalidatePath(`/admin/${venue.slug}/offers`);
}

/** Codes already used on bookings are switched off instead, so the bookings still show which offer they had. */
export async function deleteOfferCode(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await venueFrom(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const code = await prisma.promoCode.findFirst({ where: { id, venueId: venue.id }, select: { id: true, _count: { select: { bookings: true } } } });
  if (!code) return;
  if (code._count.bookings > 0) {
    await prisma.promoCode.update({ where: { id }, data: { active: false } });
    revalidatePath(`/admin/${venue.slug}/offers`);
    return { error: "Used on bookings, so it's been switched off instead of deleted." };
  }
  await prisma.promoCode.delete({ where: { id } });
  revalidatePath(`/admin/${venue.slug}/offers`);
}
