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
  // customer app at /api/venue-logo/[slug]. A newly chosen file replaces the
  // current logo and takes precedence over the remove checkbox (choosing a
  // file means "use this one", whatever the box is set to); "removeLogo" with
  // no new file clears it; neither leaves the current logo untouched. logoUrl
  // is left as-is (a legacy hosted-URL fallback), so it is not written here.
  const removeLogo = formData.get("removeLogo") === "on";
  const logoEntry = formData.get("logo");
  const hasUpload = logoEntry != null && typeof logoEntry !== "string" && logoEntry.size > 0;
  let logoData: { logoImage?: Uint8Array<ArrayBuffer> | null; logoImageType?: string | null } = {};
  if (hasUpload) {
    const file = logoEntry as File;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      return { error: "Logo must be a PNG, JPG, WEBP, GIF or SVG image." };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { error: "Logo image must be 2MB or smaller." };
    }
    logoData = { logoImage: new Uint8Array(await file.arrayBuffer()), logoImageType: file.type };
  } else if (removeLogo) {
    logoData = { logoImage: null, logoImageType: null };
  }

  // Header photo for the booking page, same handling as the logo.
  const removeHeader = formData.get("removeHeaderImage") === "on";
  const headerEntry = formData.get("headerImage");
  const hasHeader = headerEntry != null && typeof headerEntry !== "string" && headerEntry.size > 0;
  let headerData: { headerImage?: Uint8Array<ArrayBuffer> | null; headerImageType?: string | null } = {};
  if (hasHeader) {
    const file = headerEntry as File;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return { error: "The header photo must be a JPG, PNG or WEBP image." };
    }
    if (file.size > 5 * 1024 * 1024) return { error: "The header photo must be 5MB or smaller." };
    headerData = { headerImage: new Uint8Array(await file.arrayBuffer()), headerImageType: file.type };
  } else if (removeHeader) {
    headerData = { headerImage: null, headerImageType: null };
  }

  const tagline = String(formData.get("tagline") ?? "").trim().slice(0, 90) || null;

  const intOrNull = (key: string, label: string, min: number, max: number): number | null | { error: string } => {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) return { error: `${label} must be a whole number from ${min} to ${max}, or left blank.` };
    return n;
  };
  const maxCovers = intOrNull("maxCoversPer30Min", "Most guests arriving together", 1, 2000);
  if (maxCovers && typeof maxCovers === "object") return maxCovers;
  const refundHours = intOrNull("refundCutoffHours", "Free cancellation hours", 0, 720);
  if (refundHours && typeof refundHours === "object") return refundHours;

  const notificationEmail = String(formData.get("notificationEmail") ?? "").trim() || null;
  if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) return { error: "The notification email doesn't look valid." };

  const googleReviewUrl = String(formData.get("googleReviewUrl") ?? "").trim() || null;
  if (googleReviewUrl && !/^https:\/\/\S+$/.test(googleReviewUrl)) return { error: "The Google review link should start with https://" };

  const ga4MeasurementId = String(formData.get("ga4MeasurementId") ?? "").trim().toUpperCase() || null;
  if (ga4MeasurementId && !/^G-[A-Z0-9]{4,16}$/.test(ga4MeasurementId)) return { error: "The Google Analytics ID should look like G-ABC123XYZ." };
  const metaPixelId = String(formData.get("metaPixelId") ?? "").trim() || null;
  if (metaPixelId && !/^\d{6,20}$/.test(metaPixelId)) return { error: "The Meta pixel ID should be numbers only." };

  const brandColorRaw = String(formData.get("brandColorHex") ?? "").trim();
  if (brandColorRaw && !/^#[0-9a-fA-F]{6}$/.test(brandColorRaw)) {
    return { error: 'Brand colour must be a 6-digit hex code like "#7c3aed".' };
  }
  const brandColorHex = brandColorRaw || null;

  await prisma.venue.update({
    where: { id: venue.id },
    data: {
      name,
      address,
      phone,
      email,
      bookingCode,
      maxArrivalsPer30Min,
      brandColorHex,
      tagline,
      maxCoversPer30Min: maxCovers as number | null,
      ...(refundHours != null ? { refundCutoffHours: refundHours as number } : {}),
      notificationEmail,
      notifyOnNewBooking: formData.get("notifyOnNewBooking") === "on",
      notifyOnEnquiry: formData.get("notifyOnEnquiry") === "on",
      notifyOnCancellation: formData.get("notifyOnCancellation") === "on",
      dailyDigest: formData.get("dailyDigest") === "on",
      onlineBookingLive: formData.get("onlineBookingLive") === "on",
      googleReviewUrl,
      ga4MeasurementId,
      metaPixelId,
      ...logoData,
      ...headerData,
    },
  });

  revalidatePath(`/admin/${venue.slug}/details`);
  revalidatePath("/admin/settings");
}
