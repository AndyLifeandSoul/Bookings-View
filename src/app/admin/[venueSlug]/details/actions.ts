"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

/** venueId comes from a hidden form field, same pattern as every other admin actions.ts, see booking-types/actions.ts's resolveVenue() doc comment. */
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

  const maxArrivalsRaw = String(formData.get("maxArrivalsPer30Min") ?? "").trim();
  let maxArrivalsPer30Min: number | null = null;
  if (maxArrivalsRaw !== "") {
    const parsed = Number(maxArrivalsRaw);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return { error: "Max arrivals per 30 minutes must be a positive number, or left blank." };
    }
    maxArrivalsPer30Min = Math.trunc(parsed);
  }

  // Logo: an uploaded image file, stored as bytes in the DB and served by the
  // customer app at /api/venue-logo/[slug]. "removeLogo" clears it; an empty
  // file input leaves the current logo untouched. logoUrl is left as-is (a
  // legacy hosted-URL fallback), so it is deliberately not written here.
  const removeLogo = formData.get("removeLogo") === "on";
  const logoEntry = formData.get("logo");
  const hasUpload = logoEntry != null && typeof logoEntry !== "string" && logoEntry.size > 0;
  let logoData: { logoImage?: Uint8Array<ArrayBuffer> | null; logoImageType?: string | null } = {};
  if (removeLogo) {
    logoData = { logoImage: null, logoImageType: null };
  } else if (hasUpload) {
    const file = logoEntry as File;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      return { error: "Logo must be a PNG, JPG, WEBP, GIF or SVG image." };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { error: "Logo image must be 2MB or smaller." };
    }
    logoData = { logoImage: new Uint8Array(await file.arrayBuffer()), logoImageType: file.type };
  }

  const brandColorRaw = String(formData.get("brandColorHex") ?? "").trim();
  if (brandColorRaw && !/^#[0-9a-fA-F]{6}$/.test(brandColorRaw)) {
    return { error: 'Brand colour must be a 6-digit hex code like "#7c3aed".' };
  }
  const brandColorHex = brandColorRaw || null;

  await prisma.venue.update({
    where: { id: venue.id },
    data: { name, address, phone, email, bookingCode, maxArrivalsPer30Min, brandColorHex, ...logoData },
  });

  revalidatePath(`/admin/${venue.slug}/details`);
  revalidatePath("/admin/settings");
}
