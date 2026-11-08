import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { issueSession } from "@/lib/auth/issue-session";
import { TOO_MANY, clientIp, ipBlocked, isLocked, readCodeChallenge, recordFailure } from "@/lib/auth/login-guard";
import { decryptSecret, verifyTotp } from "@/lib/auth/totp";

/**
 * Step two of signing in, for logins with two-step sign-in on: the 6-digit
 * code from the authenticator app, plus the challenge step one returned.
 * Wrong codes count towards the same lockout as wrong passwords.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { challenge?: string; code?: string };
  if (!body.challenge || !body.code) return NextResponse.json({ error: "Enter the 6-digit code from your app." }, { status: 400 });
  if (ipBlocked(clientIp(request))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const staffUserId = await readCodeChallenge(body.challenge);
  if (!staffUserId) return NextResponse.json({ error: "That took too long. Sign in again.", restart: true }, { status: 401 });

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: staffUserId },
    include: { venue: { select: { id: true, slug: true, name: true } } },
  });
  if (!staffUser || !staffUser.active) return NextResponse.json({ error: "Sign in again.", restart: true }, { status: 401 });
  if (isLocked(staffUser)) return NextResponse.json({ error: TOO_MANY, restart: true }, { status: 429 });

  // Two-step sign-in switched off since step one: the password was already right.
  if (!staffUser.totpEnabledAt || !staffUser.totpSecretEnc) return issueSession(staffUser);

  const secret = decryptSecret(staffUser.totpSecretEnc);
  if (!secret) {
    console.error(`StaffUser ${staffUser.id} has a two-step secret that can't be read (AUTH_SECRET changed?).`);
    return NextResponse.json({ error: "Two-step sign-in needs setting up again. Ask an owner to switch it off for you." }, { status: 401 });
  }

  const step = verifyTotp(secret, body.code, staffUser.totpLastStep);
  if (step == null) {
    await recordFailure(staffUser);
    return NextResponse.json({ error: "That code didn't work. Check your app and try again." }, { status: 401 });
  }

  await prisma.staffUser.update({ where: { id: staffUser.id }, data: { totpLastStep: step } });
  return issueSession(staffUser);
}
