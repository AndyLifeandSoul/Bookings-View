import { redirect } from "next/navigation";
import { getCurrentStaffSession, type StaffSessionClaims } from "@/lib/auth/session";

/**
 * Every admin server action calls this itself rather than trusting that a
 * page-level guard already ran — a Server Action is its own POST endpoint,
 * reachable directly, not just something rendered behind /admin/layout.tsx.
 * Also the reason mutations below always scope writes to session.venueId
 * rather than trusting a venueId passed in form data: a STAFF session (or a
 * forged request) should never be able to touch another venue's — or even
 * their own venue's, if role is wrong — configuration by guessing at field
 * names.
 */
export async function requireAdminSession(): Promise<StaffSessionClaims> {
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login");
  if (session.role === "STAFF") redirect("/staff");
  return session;
}
