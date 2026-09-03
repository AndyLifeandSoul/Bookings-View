"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { hashPassword } from "@/lib/auth/password";
import type { ActionResult } from "@/components/action-form";
import type { StaffRole } from "@/generated/prisma";

const ROLES: StaffRole[] = ["OWNER", "MANAGER", "STAFF"];

/**
 * Managing logins is a step up from the rest of /admin (a MANAGER can edit
 * every venue's hours/booking-types/menus, but creating a login that can do
 * the same is a different level of trust) — restricted to OWNER, checked
 * here on every action rather than just by hiding the nav link, same
 * defense-in-depth reasoning as every other requireAdminSession() call.
 */
async function requireOwnerSession() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER") return { error: "Only an OWNER login can manage staff accounts." };
  return { session };
}

function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url");
}

// Not `interface CreateStaffResult extends ActionResult` — ActionResult is
// a union (`{ error?: string } | void`), and TS can't extend a union via
// interface, only an intersection/object type. Plain union type instead,
// structurally compatible with ActionResult everywhere one is expected.
export type CreateStaffResult = { error?: string; generatedPassword?: string } | void;

/**
 * Mirrors scripts/create-staff-user.ts's rules exactly (that script's doc
 * comment explains the reasoning): STAFF requires a venue, OWNER/MANAGER
 * must not have one. The CLI script stays as a bootstrap path for the very
 * first OWNER account (before any login exists to create one from), this
 * is what real day-to-day account creation goes through afterward.
 */
export async function createStaffUser(formData: FormData): Promise<CreateStaffResult> {
  const access = await requireOwnerSession();
  if ("error" in access) return access;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(formData.get("role") ?? "STAFF");
  const venueId = String(formData.get("venueId") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required." };
  if (!ROLES.includes(roleRaw as StaffRole)) return { error: `Invalid role: "${roleRaw}"` };
  const role = roleRaw as StaffRole;

  if (role === "STAFF" && !venueId) return { error: "STAFF accounts need a venue — its login is tied to one." };
  if (role !== "STAFF" && venueId) {
    return { error: `${role} accounts are venue-independent — clear the venue, or pick STAFF instead.` };
  }
  if (venueId) {
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
    if (!venue) return { error: "Unknown venue." };
  }

  const existing = await prisma.staffUser.findUnique({ where: { email } });
  if (existing) return { error: `An account already exists for ${email}.` };

  const plaintextPassword = generatePassword();
  const passwordHash = await hashPassword(plaintextPassword);

  await prisma.staffUser.create({ data: { name, email, role, venueId, passwordHash } });
  revalidatePath(`/admin/${await venueSlugForRevalidate()}/staff`);
  return { generatedPassword: plaintextPassword };
}

async function venueSlugForRevalidate(): Promise<string> {
  // The staff list isn't actually scoped to one venue (see page.tsx), but
  // revalidatePath needs *a* concrete path — any venue's /staff URL
  // revalidates the same shared list.
  const venue = await prisma.venue.findFirst({ select: { slug: true } });
  return venue?.slug ?? "dv8";
}

export async function toggleStaffActive(formData: FormData): Promise<ActionResult> {
  const access = await requireOwnerSession();
  if ("error" in access) return access;

  const id = String(formData.get("id") ?? "");
  const staffUser = await prisma.staffUser.findUnique({ where: { id }, select: { id: true, active: true } });
  if (!staffUser) return { error: "Account not found." };

  await prisma.staffUser.update({ where: { id }, data: { active: !staffUser.active } });
  revalidatePath(`/admin/${await venueSlugForRevalidate()}/staff`);
}

export async function resetStaffPassword(formData: FormData): Promise<CreateStaffResult> {
  const access = await requireOwnerSession();
  if ("error" in access) return access;

  const id = String(formData.get("id") ?? "");
  const staffUser = await prisma.staffUser.findUnique({ where: { id }, select: { id: true } });
  if (!staffUser) return { error: "Account not found." };

  const plaintextPassword = generatePassword();
  const passwordHash = await hashPassword(plaintextPassword);
  await prisma.staffUser.update({ where: { id }, data: { passwordHash } });

  return { generatedPassword: plaintextPassword };
}
