import { prisma } from "@/lib/db/client";

export interface VenueOption {
  id: string;
  slug: string;
  name: string;
}

/**
 * Every active venue, alphabetical by name. Used for the /admin venue
 * switcher and to pick a default venue when an admin session (which is
 * venue-independent — see StaffUser.venueId) lands on bare /admin with no
 * venue specified yet.
 */
export async function listActiveVenues(): Promise<VenueOption[]> {
  return prisma.venue.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}
