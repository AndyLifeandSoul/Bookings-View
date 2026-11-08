import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/issue-session";
import {
  TOO_MANY,
  clientIp,
  createCodeChallenge,
  ipBlocked,
  isLocked,
  recordFailure,
  recordUnknownEmailFailure,
  unknownEmailBlocked,
} from "@/lib/auth/login-guard";

interface LoginBody {
  email?: string;
  password?: string;
}

/**
 * Step one of signing in: email and password. With two-step sign-in on,
 * a correct password doesn't sign in yet; it returns a short-lived
 * challenge for /api/auth/login/code instead. See login-guard.ts for the
 * limits on wrong attempts.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const tooMany = () => NextResponse.json({ error: TOO_MANY }, { status: 429 });
  if (ipBlocked(clientIp(request))) return tooMany();

  const staffUser = await prisma.staffUser.findUnique({
    where: { email },
    include: { venue: { select: { id: true, slug: true, name: true } } },
  });

  // Deliberately the same error for "no such account" and "wrong password"
  // - telling an attacker which one it was is a free win for them for no
  // benefit to a real user. The lockout answer is the same for both too.
  const genericError = () => NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  if (!staffUser || !staffUser.active) {
    if (unknownEmailBlocked(email)) return tooMany();
    recordUnknownEmailFailure(email);
    return genericError();
  }

  if (isLocked(staffUser)) return tooMany();

  // Defensive, shouldn't happen: staff-account creation always requires a
  // venue for a STAFF role. Only OWNER/MANAGER are meant to have none.
  if (staffUser.role === "STAFF" && !staffUser.venue) {
    console.error(`StaffUser ${staffUser.id} has role STAFF but no venue assigned, refusing login.`);
    return genericError();
  }

  const passwordMatches = await verifyPassword(password, staffUser.passwordHash);
  if (!passwordMatches) {
    await recordFailure(staffUser);
    return genericError();
  }

  if (staffUser.totpEnabledAt && staffUser.totpSecretEnc) {
    return NextResponse.json({ needsCode: true, challenge: await createCodeChallenge(staffUser.id) });
  }

  return issueSession(staffUser);
}
