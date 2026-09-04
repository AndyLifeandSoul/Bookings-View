import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { StaffRole } from "@/generated/prisma";

export const SESSION_COOKIE_NAME = "ls_staff_session";

/**
 * 14 days, not a shorter/rolling session. Hospitality back-office logins
 * are often a shared laptop/tablet at the venue, not a personal device —
 * daily re-login would just get worked around by staff writing the
 * password on a sticky note. If a role or access needs revoking sooner
 * than that, disable the StaffUser row (`active: false`) rather than
 * relying on the session expiring.
 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set it to a random string of at least 32 characters, " +
        "`openssl rand -base64 32` is a good way to generate one. This signs staff/admin login sessions; " +
        "treat it like any other secret (never commit it, rotate it if it leaks). This is a separate secret " +
        "from anything in lifeandsoul-bookings, the two apps don't need to agree on it.",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface StaffSessionClaims extends JWTPayload {
  staffUserId: string;
  /// Null for OWNER/MANAGER — those roles are venue-independent (see
  /// StaffUser.venueId in schema.prisma) and aren't tied to one venue at
  /// login time. The admin app resolves which venue is currently being
  /// administered from the /admin/[venueSlug] route segment instead of
  /// relying on this — see requireAdminVenue(). A STAFF session always has
  /// these set (enforced at account-creation time, not by the DB).
  venueId: string | null;
  venueSlug: string | null;
  venueName: string | null;
  role: StaffRole;
  name: string;
  email: string;
}

export async function createSessionToken(claims: StaffSessionClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/** Returns null on any invalid/expired/missing token rather than throwing — callers just treat that as "not logged in". */
export async function verifySessionToken(token: string): Promise<StaffSessionClaims | null> {
  try {
    const { payload } = await jwtVerify<StaffSessionClaims>(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the session cookie for the current request. Used by
 * Server Components/Route Handlers that need to know who's logged in (to
 * scope a query to their venue, or render their name) — separate from
 * middleware.ts, which is what actually blocks unauthenticated requests
 * from reaching anything but /login in the first place.
 */
export async function getCurrentStaffSession(): Promise<StaffSessionClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
