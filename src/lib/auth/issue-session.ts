import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import type { StaffRole } from "@/generated/prisma";

/** Signs the staff member in: clears failed attempts, stamps lastLoginAt and sets the session cookie. */
export async function issueSession(staffUser: {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  venue: { id: string; slug: string; name: string } | null;
}): Promise<NextResponse> {
  const token = await createSessionToken({
    staffUserId: staffUser.id,
    venueId: staffUser.venue?.id ?? null,
    venueSlug: staffUser.venue?.slug ?? null,
    venueName: staffUser.venue?.name ?? null,
    role: staffUser.role,
    name: staffUser.name,
    email: staffUser.email,
  });

  await prisma.staffUser.update({
    where: { id: staffUser.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  const response = NextResponse.json({
    ok: true,
    staff: { name: staffUser.name, role: staffUser.role, venueName: staffUser.venue?.name ?? null },
  });
  const { name: cookieName, ...options } = sessionCookieOptions();
  response.cookies.set(cookieName, token, options);
  return response;
}
