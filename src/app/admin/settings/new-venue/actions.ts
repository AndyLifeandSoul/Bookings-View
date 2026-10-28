"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { SLUG_PATTERN, accountCodeFor, slugify } from "@/lib/venues/new-venue";
import type { ActionResult } from "@/components/action-form";

/**
 * Adds a venue (owners only). It starts with online booking switched off
 * and its own Dojo payment account record, then opens its Go live
 * checklist so the rest of setup is guided.
 */
export async function createVenue(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (session.role !== "OWNER") return { error: "Only owners can add venues." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the venue a name." };
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  if (!SLUG_PATTERN.test(slug)) return { error: "The web address can only use lower-case letters, numbers and hyphens." };
  if (await prisma.venue.findUnique({ where: { slug }, select: { id: true } })) {
    return { error: `bookmein.now/book/${slug} is already taken. Choose a different web address.` };
  }

  const email = String(formData.get("email") ?? "").trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email doesn't look right." };
  const bookingCode = String(formData.get("bookingCode") ?? "").trim().toUpperCase() || null;
  if (bookingCode && !/^[A-Z0-9]{2,8}$/.test(bookingCode)) return { error: "The reference code is 2 to 8 letters or numbers, like BBL." };
  if (bookingCode && (await prisma.venue.findFirst({ where: { bookingCode }, select: { name: true } }))) {
    return { error: `${bookingCode} is already used by another venue.` };
  }
  const legalEntityName = String(formData.get("legalEntityName") ?? "").trim().slice(0, 120) || null;

  const code = accountCodeFor(slug);
  const account = await prisma.paymentAccount.upsert({ where: { code }, update: {}, create: { code, name } });
  await prisma.venue.create({
    data: {
      name,
      slug,
      address: String(formData.get("address") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email,
      bookingCode,
      legalEntityName,
      paymentAccountId: account.id,
      onlineBookingLive: false,
    },
  });
  revalidatePath("/admin/settings");
  redirect(`/admin/${slug}/go-live`);
}
