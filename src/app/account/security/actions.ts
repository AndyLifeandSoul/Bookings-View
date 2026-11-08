"use server";

import { SignJWT, jwtVerify } from "jose";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { decryptSecret, derivedKey, encryptSecret, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";

export type SetupStart = { error: string } | { secret: string; qrSvg: string; setupToken: string };
export type SimpleResult = { error?: string; ok?: boolean };

/**
 * Starts setting up two-step sign-in: a new secret, shown as a QR code (and
 * as text for typing in). Nothing is saved yet. The secret travels back
 * encrypted inside a signed 10-minute token and is only stored once the
 * first code from the app has been checked against it.
 */
export async function startTotpSetup(): Promise<SetupStart> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Sign in again." };
  const secret = generateTotpSecret();
  const qrSvg = await QRCode.toString(otpauthUri(session.email, secret), { type: "svg", margin: 1, width: 200 });
  const setupToken = await new SignJWT({ staffUserId: session.staffUserId, enc: encryptSecret(secret), purpose: "totp-setup" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(derivedKey("totp-setup"));
  return { secret, qrSvg, setupToken };
}

export async function confirmTotpSetup(setupToken: string, code: string): Promise<SimpleResult> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Sign in again." };
  let payload: { staffUserId: string; enc: string; purpose: string };
  try {
    ({ payload } = await jwtVerify<{ staffUserId: string; enc: string; purpose: string }>(setupToken, derivedKey("totp-setup")));
  } catch {
    return { error: "That took too long. Start again." };
  }
  if (payload.purpose !== "totp-setup" || payload.staffUserId !== session.staffUserId) return { error: "Start again." };
  const secret = decryptSecret(payload.enc);
  if (!secret) return { error: "Start again." };
  const step = verifyTotp(secret, code, null);
  if (step == null) return { error: "That code didn't match. Check the time on your phone is right and try the next code." };
  await prisma.staffUser.update({
    where: { id: session.staffUserId },
    data: { totpSecretEnc: payload.enc, totpEnabledAt: new Date(), totpLastStep: step },
  });
  revalidatePath("/account/security");
  return { ok: true };
}

/** Switching it off needs a current code, so someone at an unlocked screen can't quietly remove it. */
export async function disableTotp(code: string): Promise<SimpleResult> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Sign in again." };
  const user = await prisma.staffUser.findUnique({ where: { id: session.staffUserId }, select: { totpSecretEnc: true, totpLastStep: true } });
  if (!user?.totpSecretEnc) return { ok: true };
  const secret = decryptSecret(user.totpSecretEnc);
  const step = secret ? verifyTotp(secret, code, user.totpLastStep) : null;
  if (step == null) return { error: "That code didn't work." };
  await prisma.staffUser.update({
    where: { id: session.staffUserId },
    data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null },
  });
  revalidatePath("/account/security");
  return { ok: true };
}
