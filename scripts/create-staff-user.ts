import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { hashPassword } from "../src/lib/auth/password";

/**
 * Bootstrap script for creating/updating a staff login until there's an
 * admin UI for managing StaffUser rows (Phase B — see the admin view in
 * the wider plan). Run with:
 *
 *   npm run staff:create -- --email=andy@lifeandsoul.ltd --name="Andy" --venue=dv8 --role=OWNER
 *
 * Omit --password and one is generated and printed once — it is never
 * stored anywhere but the (hashed) database row, so save it somewhere safe
 * immediately. Re-running with the same --email updates that user (name,
 * venue, role, and password if a new one is given) rather than duplicating.
 */

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url");
}

async function main() {
  const args = parseArgs();
  const email = args.email?.trim().toLowerCase();
  const name = args.name?.trim();
  const venueSlug = args.venue?.trim();
  const role = (args.role?.trim().toUpperCase() || "STAFF") as "OWNER" | "MANAGER" | "STAFF";

  if (!email || !name || !venueSlug) {
    console.error(
      "Usage: npm run staff:create -- --email=you@example.com --name=\"Your Name\" --venue=dv8 [--role=OWNER|MANAGER|STAFF] [--password=...]",
    );
    process.exit(1);
  }
  if (!["OWNER", "MANAGER", "STAFF"].includes(role)) {
    console.error(`Invalid --role "${role}". Must be OWNER, MANAGER, or STAFF.`);
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
    if (!venue) {
      console.error(`No venue with slug "${venueSlug}". Check lifeandsoul-bookings' seed data for valid slugs.`);
      process.exit(1);
    }

    const plaintextPassword = args.password || generatePassword();
    const passwordHash = await hashPassword(plaintextPassword);

    const staffUser = await prisma.staffUser.upsert({
      where: { email },
      update: { name, role, venueId: venue.id, passwordHash, active: true },
      create: { email, name, role, venueId: venue.id, passwordHash },
    });

    console.log(`\nStaff login ready for ${venue.name}:`);
    console.log(`  Email:    ${staffUser.email}`);
    console.log(`  Role:     ${staffUser.role}`);
    if (!args.password) {
      console.log(`  Password: ${plaintextPassword}`);
      console.log("\n(This password is shown once and not stored anywhere but the hashed DB row — save it now.)");
    } else {
      console.log("  Password: (set to the value you provided)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
