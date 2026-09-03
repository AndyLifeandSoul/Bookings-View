import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

/**
 * Same Prisma singleton pattern as lifeandsoul-bookings — this app talks to
 * the SAME Postgres database (see prisma/schema.prisma's header comment),
 * just never runs migrations against it.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
