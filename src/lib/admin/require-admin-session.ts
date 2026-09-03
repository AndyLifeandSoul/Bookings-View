import { redirect } from "next/navigation";
import { getCurrentStaffSession, type StaffSessionClaims } from "@/lib/auth/session";

/**
 * Every admin server action calls this itself rather than trusting that a
 * page-level guard already ran — a Server Action is its own POST endpoint,
 * reachable directly, not just something rendered behind /admin/layout.tsx.
 * This is the entire security boundary for /admin now: OWNER/MANAGER
 * sessions are venue-independent (see StaffUser.venueId in schema.prisma),
 * so there's no per-session venueId left to scope writes to — every action
 * takes its venueId from a hidden form field instead (see requireAdminVenue
 * and each actions.ts's resolveVenue()) and trusts it, by design, for
 * anyone who gets this far. What this function stops is a STAFF session (or
 * an unauthenticated request) reaching any of it at all.
 */
export async function requireAdminSession(): Promise<StaffSessionClaims> {
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login");
  if (session.role === "STAFF") redirect("/staff");
  return session;
}
