import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { email },
    include: { venue: { select: { id: true, slug: true, name: true } } },
  });

  // Deliberately the same error for "no such account" and "wrong password"
  // — telling an attacker which one it was is a free win for them for no
  // benefit to a real user.
  const genericError = () => NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  if (!staffUser || !staffUser.active) return genericError();

  const passwordMatches = await verifyPassword(password, staffUser.passwordHash);
  if (!passwordMatches) return genericError();

  const token = await createSessionToken({
    staffUserId: staffUser.id,
    venueId: staffUser.venue.id,
    venueSlug: staffUser.venue.slug,
    venueName: staffUser.venue.name,
    role: staffUser.role,
    name: staffUser.name,
    email: staffUser.email,
  });

  await prisma.staffUser.update({ where: { id: staffUser.id }, data: { lastLoginAt: new Date() } });

  const response = NextResponse.json({ ok: true, staff: { name: staffUser.name, role: staffUser.role, venueName: staffUser.venue.name } });
  const { name: cookieName, ...options } = sessionCookieOptions();
  response.cookies.set(cookieName, token, options);
  return response;
}
