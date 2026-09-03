"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

function parseMenuFields(formData: FormData): { name: string; description: string | null; active: boolean; bookingTypeId: string | null } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const bookingTypeId = String(formData.get("bookingTypeId") ?? "").trim() || null;
  return { name, description, active, bookingTypeId };
}

export async function createMenu(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  const parsed = parseMenuFields(formData);
  if ("error" in parsed) return parsed;

  if (parsed.bookingTypeId) {
    const bookingType = await prisma.bookingType.findFirst({
      where: { id: parsed.bookingTypeId, venueId: session.venueId },
    });
    if (!bookingType) return { error: "That booking type doesn't belong to this venue." };
  }

  const menu = await prisma.menu.create({ data: { venueId: session.venueId, ...parsed } });
  revalidatePath("/admin/menus");
  redirect(`/admin/menus/${menu.id}`);
}

export async function updateMenu(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  const parsed = parseMenuFields(formData);
  if ("error" in parsed) return parsed;

  if (parsed.bookingTypeId) {
    const bookingType = await prisma.bookingType.findFirst({
      where: { id: parsed.bookingTypeId, venueId: session.venueId },
    });
    if (!bookingType) return { error: "That booking type doesn't belong to this venue." };
  }

  const result = await prisma.menu.updateMany({ where: { id, venueId: session.venueId }, data: parsed });
  if (result.count === 0) return { error: "Menu not found for this venue." };

  revalidatePath("/admin/menus");
  revalidatePath(`/admin/menus/${id}`);
}

export async function deleteMenu(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  const id = String(formData.get("id") ?? "");

  const menu = await prisma.menu.findFirst({ where: { id, venueId: session.venueId }, select: { name: true } });
  if (!menu) return { error: "Menu not found for this venue." };

  const preOrderCount = await prisma.preOrder.count({ where: { menuId: id } });
  if (preOrderCount > 0) {
    await prisma.menu.updateMany({ where: { id, venueId: session.venueId }, data: { active: false } });
    revalidatePath("/admin/menus");
    return {
      error: `"${menu.name}" has ${preOrderCount} pre-order(s) against it, so it can't be deleted — deactivated instead.`,
    };
  }

  // Deleting the menu cascades to its MenuItems (onDelete: Cascade in schema).
  await prisma.menu.deleteMany({ where: { id, venueId: session.venueId } });
  revalidatePath("/admin/menus");
  redirect("/admin/menus");
}

function parsePriceToPence(formData: FormData): number | { error: string } {
  const pounds = Number(formData.get("pricePounds"));
  if (!Number.isFinite(pounds) || pounds < 0) return { error: "Enter a valid price." };
  return Math.round(pounds * 100);
}

function parseDietaryTags(formData: FormData): string[] {
  const raw = String(formData.get("dietaryTags") ?? "");
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function assertMenuBelongsToVenue(menuId: string, venueId: string): Promise<boolean> {
  const menu = await prisma.menu.findFirst({ where: { id: menuId, venueId }, select: { id: true } });
  return Boolean(menu);
}

export async function createMenuItem(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  const menuId = String(formData.get("menuId") ?? "");
  if (!(await assertMenuBelongsToVenue(menuId, session.venueId))) {
    return { error: "Menu not found for this venue." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  const priceOrError = parsePriceToPence(formData);
  if (typeof priceOrError !== "number") return priceOrError;

  await prisma.menuItem.create({
    data: {
      menuId,
      name,
      description,
      active,
      priceInPence: priceOrError,
      dietaryTags: parseDietaryTags(formData),
    },
  });
  revalidatePath(`/admin/menus/${menuId}`);
}

export async function updateMenuItem(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menuId") ?? "");
  if (!(await assertMenuBelongsToVenue(menuId, session.venueId))) {
    return { error: "Menu not found for this venue." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  const priceOrError = parsePriceToPence(formData);
  if (typeof priceOrError !== "number") return priceOrError;

  const result = await prisma.menuItem.updateMany({
    where: { id, menuId },
    data: { name, description, active, priceInPence: priceOrError, dietaryTags: parseDietaryTags(formData) },
  });
  if (result.count === 0) return { error: "Menu item not found." };

  revalidatePath(`/admin/menus/${menuId}`);
}

export async function deleteMenuItem(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menuId") ?? "");
  if (!(await assertMenuBelongsToVenue(menuId, session.venueId))) {
    return { error: "Menu not found for this venue." };
  }

  const item = await prisma.menuItem.findFirst({ where: { id, menuId }, select: { name: true } });
  if (!item) return { error: "Menu item not found." };

  const preOrderItemCount = await prisma.preOrderItem.count({ where: { menuItemId: id } });
  if (preOrderItemCount > 0) {
    await prisma.menuItem.updateMany({ where: { id, menuId }, data: { active: false } });
    revalidatePath(`/admin/menus/${menuId}`);
    return {
      error: `"${item.name}" is on ${preOrderItemCount} existing pre-order(s), so it can't be deleted — deactivated instead.`,
    };
  }

  await prisma.menuItem.deleteMany({ where: { id, menuId } });
  revalidatePath(`/admin/menus/${menuId}`);
}
