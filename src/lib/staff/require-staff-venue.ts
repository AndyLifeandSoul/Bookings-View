import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import type { StaffSessionClaims } from "@/lib/auth/session";

export interface StaffVenue {
  id: string;
  slug: string;
  name: string;
  /// IANA zone (Venue.timezone in schema.prisma, e.g. "Europe/London") — for
  /// formatting real timestamp columns (Booking.checkedInAt/checkedOutAt/
  /// createdAt, Message.createdAt) in the venue's own local time. These
  /// pages render server-side, so `.toLocaleTimeString()` with no explicit
  /// timeZone uses the *server's* zone (UTC in production), not the
  /// viewer's browser — silently mislabeling BST times as if they were UTC.
  /// Doesn't apply to the app's many plain "HH:mm" fields (booking
  /// startTime/endTime, opening hours, etc) — those are stored venue-local
  /// with no conversion by design (see Venue.timezone's doc comment) and
  /// are rendered as-is.
  timezone: string;
}

/**
 * Every page under /staff/[venueSlug] calls this. A STAFF session is tied
 * to exactly one venue (session.venueSlug) — asked to view a *different*
 * venue's diary, it's redirected back to its own rather than shown a 404,
 * since typing another venue's slug in the URL is a plausible accident, not
 * an attack worth being cryptic about. OWNER/MANAGER are venue-independent
 * and can view any active venue's diary.
 */
export async function requireStaffVenue(
  venueSlug: string,
): Promise<{ session: StaffSessionClaims; venue: StaffVenue }> {
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login");

  if (session.role === "STAFF") {
    if (session.venueSlug !== venueSlug) {
      redirect(`/staff/${session.venueSlug}`);
    }
  }

  const venue = await prisma.venue.findUnique({
    where: { slug: venueSlug },
    select: { id: true, slug: true, name: true, active: true, timezone: true },
  });
  if (!venue || !venue.active) notFound();

  return { session, venue };
}
