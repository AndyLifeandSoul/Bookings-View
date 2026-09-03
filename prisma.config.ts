import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// No `migrations` block, deliberately — this repo never runs `prisma
// migrate`. See the header comment in prisma/schema.prisma: migrations
// against the shared database are owned entirely by the lifeandsoul-
// bookings repo. This config only needs to support `prisma generate`.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
