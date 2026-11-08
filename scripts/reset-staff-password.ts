import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { hashPassword } from "../src/lib/auth/password";

/**
 * Gives an existing staff login a new password, changing nothing else
 * (name, role and venue stay as they are, unlike staff:create which
 * rewrites them). With no email it lists every login so you can see who
 * exists. The new password is generated, printed once and never stored
 * anywhere but the hashed database row.
 *
 *   npm run staff:reset-password
 *   npm run staff:reset-password -- --email=andy@lifeandsoul.ltd
 *   npm run staff:reset-password -- --email=andy@lifeandsoul.ltd --clear-2fa
 *
 * Point DATABASE_URL at the database you mean (the live one for live
 * logins), for example by prefixing the command with DATABASE_URL="...".
 */
async function main() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--email="));
  const email = arg?.slice("--email=".length).trim().toLowerCase();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    if (!email) {
      const users = await prisma.staffUser.findMany({
        orderBy: { email: "asc" },
        select: { email: true, name: true, role: true, active: true, lastLoginAt: true, venue: { select: { name: true } } },
      });
      console.log(`\n${users.length} staff logins:\n`);
      for (const u of users) {
        const last = u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : "never";
        console.log(`  ${u.email}  ${u.role}${u.venue ? ` (${u.venue.name})` : ""}  ${u.active ? "" : "INACTIVE  "}last signed in ${last}`);
      }
      console.log("\nReset one with: npm run staff:reset-password -- --email=<email>");
      return;
    }
    const user = await prisma.staffUser.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      console.error(`No staff login for ${email}. Run without --email to list them.`);
      process.exit(1);
    }
    const password = crypto.randomBytes(15).toString("base64url");
    // Also lifts any lockout, and with --clear-2fa switches two-step sign-in off
    // (for an owner who has lost the phone with their authenticator app).
    const clear2fa = process.argv.includes("--clear-2fa");
    await prisma.staffUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        active: true,
        failedLoginCount: 0,
        lockedUntil: null,
        ...(clear2fa ? { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null } : {}),
      },
    });
    console.log(`\nNew password for ${email} (${user.role}):\n\n  ${password}\n\nShown once. Save it in your password manager now, then sign in.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
