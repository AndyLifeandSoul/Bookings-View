# Life & Soul — Staff / Admin

The staff and admin portal for the Life & Soul bookings platform, deliberately kept as a **separate app on a separate URL** from [`lifeandsoul-bookings`](https://github.com/AndyLifeandSoul/lifeandsoul-bookings) (the customer-facing booking flow). The reason for the split: the customer app is eventually going to be embedded as a widget on each venue's own website, and that origin should never also carry a staff login — no shared domain, no risk of a customer ever seeing a "sign in" option.

## Shared database, separate everything else

This app reads and writes the **same Postgres database** as `lifeandsoul-bookings` — same `Booking`, `Venue`, `StaffUser` tables, etc. But only one of the two repos is allowed to change the shape of that database:

- **`lifeandsoul-bookings` owns the schema and migration history.** Its Railway pre-deploy command runs `prisma migrate deploy` against production on every deploy.
- **This repo never runs `prisma migrate dev` or `prisma migrate deploy`.** `prisma/schema.prisma` here is a mirrored copy, kept only so `prisma generate` can produce a Prisma Client for this app's own queries — see the header comment in that file. There's no `prisma/migrations` directory here on purpose.

**When the schema changes:** edit it in `lifeandsoul-bookings` first, apply the migration there, then copy the resulting `schema.prisma` into this repo and run `npx prisma generate`. Skipping this — editing the two independently — is exactly how the apps drift apart and start fighting over the database.

## Stack

Same as `lifeandsoul-bookings`: Next.js 16 (App Router, TypeScript), Prisma 7 with the driver adapter model, Tailwind. Auth is hand-rolled (not a library) — email+password, bcrypt-hashed, a signed JWT in an httpOnly cookie (`src/lib/auth/`) — deliberately simple rather than pulling in a full auth framework for what's currently just "staff sign in, three roles."

## Status

**Staff view (done):** `/staff` — a read-only diary of upcoming bookings for the signed-in staff member's venue (date, time, party size, customer contact, status, notes). Login at `/login`, session lasts 14 days (shared venue devices, not personal logins — see the comment in `src/lib/auth/session.ts`).

**Admin view (not built yet):** `/admin` is already gated in `middleware.ts` (OWNER/MANAGER only, not STAFF) but has no pages yet. This is where booking type configuration, opening hours, pre-order menus, and closing dates will live — matching what Access Collins' admin side does today.

## Roles

`StaffRole` is `OWNER` / `MANAGER` / `STAFF`. Every `StaffUser` row is scoped to exactly one venue — there's no cross-venue login yet, so someone who needs to see more than one venue (e.g. Andy) gets one `StaffUser` row per venue. `/staff` only ever shows the signed-in user's own venue; `/admin` additionally requires MANAGER or OWNER.

## Setup

```bash
npm install
cp .env.example .env   # DATABASE_URL should point at the same DB lifeandsoul-bookings uses; generate AUTH_SECRET with `openssl rand -base64 32`
npm run dev
```

There's no seed script here (seeding venues/bookings is `lifeandsoul-bookings`' job). To create the first staff login:

```bash
npm run staff:create -- --email=you@example.com --name="Your Name" --venue=dv8 --role=OWNER
```

Prints a generated password once (or pass `--password=...` to set your own). This is the bootstrap path for every staff login until the admin view exists to manage them from the UI.
