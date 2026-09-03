"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

/** venueId comes from a hidden form field, same pattern as every other admin actions.ts — see booking-types/actions.ts's resolveVenue() doc comment. */
async function resolveVenue(formData: FormData): Promise<{ id: string; slug: string } | { error: string }> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  if (!venueId) return { error: "Missing venue." };
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return { error: "Unknown venue." };
  return venue;
}

export async function updateVenueDetails(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  if (email && !email.includes("@")) return { error: "Email doesn't look valid." };

  const bookingCodeRaw = String(formData.get("bookingCode") ?? "")
    .trim()
    .toUpperCase();
  const bookingCode = bookingCodeRaw || null;
  if (bookingCode && !/^[A-Z0-9]{2,8}$/.test(bookingCode)) {
    return { error: "Booking code must be 2-8 letters/numbers, e.g. \"DV8\" or \"BB\"." };
  }
  if (bookingCode) {
    const clash = await prisma.venue.findFirst({
      where: { bookingCode, id: { not: venue.id } },
      select: { name: true },
    });
    if (clash) return { error: `Booking code "${bookingCode}" is already used by ${clash.name}.` };
  }

  await prisma.venue.update({
    where: { id: venue.id },
    data: { name, address, phone, email, bookingCode },
  });

  revalidatePath(`/admin/${venue.slug}/details`);
  revalidatePath("/admin/settings");
}
