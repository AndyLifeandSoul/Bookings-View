import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db/client";
import { derivedKey } from "@/lib/auth/totp";

/**
 * Limits on guessing staff passwords and codes.
 *
 *  - Per login: 5 wrong passwords or codes in a row lock it for 15 minutes
 *    (StaffUser.failedLoginCount / lockedUntil, so it survives a redeploy).
 *  - Per email that has no login: the same 5-in-15-minutes, kept in memory,
 *    so the "too many attempts" answer can't be used to find out which
 *    emails have accounts.
 *  - Per IP address: 30 attempts in 15 minutes, in memory, against one
 *    address trying lots of different emails.
 *
 * The in-memory counts reset when the service restarts and are per
 * instance; the app runs a single instance, and the per-login lock (the one
 * that matters) is in the database.
 */

export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;
const WINDOW_MS = LOCK_MINUTES * 60 * 1000;
const IP_LIMIT = 30;

interface Bucket {
  count: number;
  resetAt: number;
}
const ipBuckets = new Map<string, Bucket>();
const unknownEmailBuckets = new Map<string, Bucket>();

function bump(map: Map<string, Bucket>, key: string, now = Date.now()): number {
  if (map.size > 10_000) for (const [k, b] of map) if (b.resetAt <= now) map.delete(k);
  const b = map.get(key);
  if (!b || b.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return 1;
  }
  b.count += 1;
  return b.count;
}

function peek(map: Map<string, Bucket>, key: string, now = Date.now()): number {
  const b = map.get(key);
  return !b || b.resetAt <= now ? 0 : b.count;
}

export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export const TOO_MANY = `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`;

/** Counts this attempt against the IP; true when the IP is over its limit. */
export function ipBlocked(ip: string): boolean {
  return bump(ipBuckets, ip) > IP_LIMIT;
}

export function unknownEmailBlocked(email: string): boolean {
  return peek(unknownEmailBuckets, email) >= MAX_FAILURES;
}

export function recordUnknownEmailFailure(email: string): void {
  bump(unknownEmailBuckets, email);
}

export function isLocked(user: { lockedUntil: Date | null }): boolean {
  return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
}

/** One more wrong password or code; locks the login when it reaches the limit. */
export async function recordFailure(user: { id: string; failedLoginCount: number; lockedUntil: Date | null }): Promise<void> {
  // A lock that has run out starts the count again.
  const base = user.lockedUntil && user.lockedUntil.getTime() <= Date.now() ? 0 : user.failedLoginCount;
  const count = base + 1;
  await prisma.staffUser.update({
    where: { id: user.id },
    data:
      count >= MAX_FAILURES
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + WINDOW_MS) }
        : { failedLoginCount: count, ...(base === 0 ? { lockedUntil: null } : {}) },
  });
}

export async function clearFailures(userId: string): Promise<void> {
  await prisma.staffUser.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } });
}

/*
 * The short-lived token handed back after a correct password when a code is
 * still needed. Signed with its own derived key, not the session key, so it
 * can never be used as a session cookie to skip the code.
 */
const CHALLENGE_MINUTES = 5;

export async function createCodeChallenge(staffUserId: string): Promise<string> {
  return new SignJWT({ staffUserId, purpose: "second-step" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_MINUTES}m`)
    .sign(derivedKey("second-step-challenge"));
}

export async function readCodeChallenge(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify<{ staffUserId: string; purpose: string }>(token, derivedKey("second-step-challenge"));
    return payload.purpose === "second-step" ? payload.staffUserId : null;
  } catch {
    return null;
  }
}
