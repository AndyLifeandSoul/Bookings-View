import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "./require-admin-session";
import type { StaffSessionClaims } from "@/lib/auth/session";

export interface AdminVenue {
  id: string;
  slug: string;
  name: string;
}

/**
 * Every page under /admin/[venueSlug] calls this instead of
 * requireAdminSession() directly. Admin sessions are venue-independent (see
 * StaffUser.venueId in schema.prisma) — OWNER/MANAGER can see and edit every
 * venue from one login — so "which venue is being administered right now"
 * comes entirely from the URL's venueSlug segment, never from the session.
 * That's what makes the venue switcher a plain link with no server-side
 * "current venue" state to keep in sync, and what makes it safe for two
 * browser tabs to administer two different venues at once under one login.
 */
export async function requireAdminVenue(
  venueSlug: string,
): Promise<{ session: StaffSessionClaims; venue: AdminVenue }> {
  const session = await requireAdminSession();
  const venue = await prisma.venue.findUnique({
    where: { slug: venueSlug },
    select: { id: true, slug: true, name: true, active: true },
  });
  if (!venue || !venue.active) notFound();
  return { session, venue };
}
