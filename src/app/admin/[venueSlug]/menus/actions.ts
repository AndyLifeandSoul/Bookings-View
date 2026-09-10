"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

/** venueId comes from a hidden form field (set from the page's route param) — admin sessions are venue-independent, see requireAdminVenue(). */
async function resolveVenue(formData: FormData): Promise<{ id: string; slug: string } | { error: string }> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  if (!venueId) return { error: "Missing venue." };
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true } });
  if (!venue) return { error: "Unknown venue." };
  return venue;
}

function parseMenuFields(formData: FormData): { name: string; description: string | null; active: boolean; bookingTypeId: string | null } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const bookingTypeId = String(formData.get("bookingTypeId") ?? "").trim() || null;
  return { name, description, active, bookingTypeId };
}

export async function createMenu(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const parsed = parseMenuFields(formData);
  if ("error" in parsed) return parsed;

  if (parsed.bookingTypeId) {
    const bookingType = await prisma.bookingType.findFirst({
      where: { id: parsed.bookingTypeId, venueId: venue.id },
    });
    if (!bookingType) return { error: "That booking type doesn't belong to this venue." };
  }

  const menu = await prisma.menu.create({ data: { venueId: venue.id, ...parsed } });
  revalidatePath(`/admin/${venue.slug}/menus`);
  redirect(`/admin/${venue.slug}/menus/${menu.id}`);
}

export async function updateMenu(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const parsed = parseMenuFields(formData);
  if ("error" in parsed) return parsed;

  if (parsed.bookingTypeId) {
    const bookingType = await prisma.bookingType.findFirst({
      where: { id: parsed.bookingTypeId, venueId: venue.id },
    });
    if (!bookingType) return { error: "That booking type doesn't belong to this venue." };
  }

  const result = await prisma.menu.updateMany({ where: { id, venueId: venue.id }, data: parsed });
  if (result.count === 0) return { error: "Menu not found for this venue." };

  revalidatePath(`/admin/${venue.slug}/menus`);
  revalidatePath(`/admin/${venue.slug}/menus/${id}`);
}

export async function deleteMenu(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

  const menu = await prisma.menu.findFirst({ where: { id, venueId: venue.id }, select: { name: true } });
  if (!menu) return { error: "Menu not found for this venue." };

  const preOrderCount = await prisma.preOrder.count({ where: { menuId: id } });
  if (preOrderCount > 0) {
    await prisma.menu.updateMany({ where: { id, venueId: venue.id }, data: { active: false } });
    revalidatePath(`/admin/${venue.slug}/menus`);
    return {
      error: `"${menu.name}" has ${preOrderCount} pre-order(s) against it, so it can't be deleted, deactivated instead.`,
    };
  }

  // Deleting the menu cascades to its MenuItems (onDelete: Cascade in schema).
  await prisma.menu.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/menus`);
  redirect(`/admin/${venue.slug}/menus`);
}

/**
 * MenuCategory is per-venue, not per-menu (see schema.prisma) - DV8's
 * "Starters"/"Mains"/"Desserts" apply the same way across every pre-order
 * menu the venue has, rather than being redefined per menu. Managed here
 * on the venue-level menus page, not inside an individual menu's detail
 * page.
 */
export async function createMenuCategory(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  try {
    await prisma.menuCategory.create({ data: { venueId: venue.id, name, sortOrder } });
  } catch {
    return { error: `"${name}" already exists for this venue.` };
  }
  revalidatePath(`/admin/${venue.slug}/menus`);
}

export async function updateMenuCategory(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  try {
    const result = await prisma.menuCategory.updateMany({ where: { id, venueId: venue.id }, data: { name, sortOrder } });
    if (result.count === 0) return { error: "Category not found for this venue." };
  } catch {
    return { error: `"${name}" already exists for this venue.` };
  }
  revalidatePath(`/admin/${venue.slug}/menus`);
}

/**
 * No blocking check before delete, unlike deleteMenu/deleteMenuItem: a
 * category going away just un-categorises whatever items pointed at it
 * (MenuItem.categoryId is ON DELETE SET NULL, see schema.prisma) rather
 * than losing anything, so there's no data-loss case to guard against here.
 */
export async function deleteMenuCategory(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

  const result = await prisma.menuCategory.deleteMany({ where: { id, venueId: venue.id } });
  if (result.count === 0) return { error: "Category not found for this venue." };
  revalidatePath(`/admin/${venue.slug}/menus`);
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
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuId = String(formData.get("menuId") ?? "");
  if (!(await assertMenuBelongsToVenue(menuId, venue.id))) {
    return { error: "Menu not found for this venue." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  const priceOrError = parsePriceToPence(formData);
  if (typeof priceOrError !== "number") return priceOrError;

  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  if (categoryId && !(await prisma.menuCategory.findFirst({ where: { id: categoryId, venueId: venue.id } }))) {
    return { error: "That category doesn't belong to this venue." };
  }

  await prisma.menuItem.create({
    data: {
      menuId,
      categoryId,
      name,
      description,
      active,
      priceInPence: priceOrError,
      dietaryTags: parseDietaryTags(formData),
    },
  });
  revalidatePath(`/admin/${venue.slug}/menus/${menuId}`);
}

export async function updateMenuItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menuId") ?? "");
  if (!(await assertMenuBelongsToVenue(menuId, venue.id))) {
    return { error: "Menu not found for this venue." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  const priceOrError = parsePriceToPence(formData);
  if (typeof priceOrError !== "number") return priceOrError;

  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  if (categoryId && !(await prisma.menuCategory.findFirst({ where: { id: categoryId, venueId: venue.id } }))) {
    return { error: "That category doesn't belong to this venue." };
  }

  const result = await prisma.menuItem.updateMany({
    where: { id, menuId },
    data: { name, description, active, categoryId, priceInPence: priceOrError, dietaryTags: parseDietaryTags(formData) },
  });
  if (result.count === 0) return { error: "Menu item not found." };

  revalidatePath(`/admin/${venue.slug}/menus/${menuId}`);
}

export async function deleteMenuItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menuId") ?? "");
  if (!(await assertMenuBelongsToVenue(menuId, venue.id))) {
    return { error: "Menu not found for this venue." };
  }

  const item = await prisma.menuItem.findFirst({ where: { id, menuId }, select: { name: true } });
  if (!item) return { error: "Menu item not found." };

  const preOrderItemCount = await prisma.preOrderItem.count({ where: { menuItemId: id } });
  if (preOrderItemCount > 0) {
    await prisma.menuItem.updateMany({ where: { id, menuId }, data: { active: false } });
    revalidatePath(`/admin/${venue.slug}/menus/${menuId}`);
    return {
      error: `"${item.name}" is on ${preOrderItemCount} existing pre-order(s), so it can't be deleted, deactivated instead.`,
    };
  }

  await prisma.menuItem.deleteMany({ where: { id, menuId } });
  revalidatePath(`/admin/${venue.slug}/menus/${menuId}`);
}

// ---------------------------------------------------------------------------
// Item customisation (modifier groups/options)
// ---------------------------------------------------------------------------

function parsePriceDeltaToPence(formData: FormData): number | { error: string } {
  const raw = formData.get("priceDeltaPounds");
  const pounds = raw === null || raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(pounds)) return { error: "Enter a valid price." };
  return Math.round(pounds * 100);
}

/**
 * ModifierGroup is venue-scoped, not per-item (see schema.prisma) -
 * "Cheese" only needs defining once even though several dishes might offer
 * it, the same relationship MenuCategory has to Menu. Managed here on the
 * venue-level menus page, alongside categories.
 */
export async function createModifierGroup(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  try {
    await prisma.modifierGroup.create({ data: { venueId: venue.id, name } });
  } catch {
    return { error: `"${name}" already exists for this venue.` };
  }
  revalidatePath(`/admin/${venue.slug}/menus`);
}

export async function updateModifierGroup(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const active = formData.get("active") === "on";

  try {
    const result = await prisma.modifierGroup.updateMany({ where: { id, venueId: venue.id }, data: { name, active } });
    if (result.count === 0) return { error: "Group not found for this venue." };
  } catch {
    return { error: `"${name}" already exists for this venue.` };
  }
  revalidatePath(`/admin/${venue.slug}/menus`);
}

/**
 * Blocked while any menu item still has this group attached as a step -
 * unlike MenuCategory (where un-setting a deleted category is harmless),
 * silently dropping a step from an item's customisation wizard would
 * change what that item asks customers for without anyone deciding that on
 * purpose. Detach it from every item first (its step count is shown next
 * to it in the admin UI), then delete.
 */
export async function deleteModifierGroup(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

  const group = await prisma.modifierGroup.findFirst({
    where: { id, venueId: venue.id },
    select: { name: true, _count: { select: { itemGroups: true } } },
  });
  if (!group) return { error: "Group not found for this venue." };
  if (group._count.itemGroups > 0) {
    return {
      error: `"${group.name}" is used as a step on ${group._count.itemGroups} menu item(s) - remove it from those first.`,
    };
  }

  await prisma.modifierGroup.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/menus`);
}

async function assertGroupBelongsToVenue(groupId: string, venueId: string): Promise<boolean> {
  const group = await prisma.modifierGroup.findFirst({ where: { id: groupId, venueId }, select: { id: true } });
  return Boolean(group);
}

export async function createModifierOption(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const groupId = String(formData.get("groupId") ?? "");
  if (!(await assertGroupBelongsToVenue(groupId, venue.id))) return { error: "Group not found for this venue." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const priceDeltaOrError = parsePriceDeltaToPence(formData);
  if (typeof priceDeltaOrError !== "number") return priceDeltaOrError;
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  try {
    await prisma.modifierOption.create({
      data: { groupId, name, priceDeltaPence: priceDeltaOrError, sortOrder },
    });
  } catch {
    return { error: `"${name}" already exists in this group.` };
  }
  revalidatePath(`/admin/${venue.slug}/menus`);
}

export async function updateModifierOption(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const groupId = String(formData.get("groupId") ?? "");
  if (!(await assertGroupBelongsToVenue(groupId, venue.id))) return { error: "Group not found for this venue." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const priceDeltaOrError = parsePriceDeltaToPence(formData);
  if (typeof priceDeltaOrError !== "number") return priceDeltaOrError;
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
  const active = formData.get("active") === "on";

  try {
    const result = await prisma.modifierOption.updateMany({
      where: { id, groupId },
      data: { name, priceDeltaPence: priceDeltaOrError, sortOrder, active },
    });
    if (result.count === 0) return { error: "Option not found." };
  } catch {
    return { error: `"${name}" already exists in this group.` };
  }
  revalidatePath(`/admin/${venue.slug}/menus`);
}

/**
 * Always safe to delete outright, unlike menus/menu items: a historical
 * order's PreOrderItemModifier row snapshots the option's name and price
 * at order time (optionId itself is ON DELETE SET NULL, see schema.prisma)
 * so removing the live option here can never change what a past customer
 * is shown to have ordered.
 */
export async function deleteModifierOption(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const groupId = String(formData.get("groupId") ?? "");
  if (!(await assertGroupBelongsToVenue(groupId, venue.id))) return { error: "Group not found for this venue." };

  const id = String(formData.get("id") ?? "");
  const result = await prisma.modifierOption.deleteMany({ where: { id, groupId } });
  if (result.count === 0) return { error: "Option not found." };
  revalidatePath(`/admin/${venue.slug}/menus`);
}

async function assertMenuItemBelongsToVenue(menuItemId: string, venueId: string): Promise<{ menuId: string } | null> {
  return prisma.menuItem.findFirst({ where: { id: menuItemId, menu: { venueId } }, select: { menuId: true } });
}

export async function attachModifierGroupToItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuItemId = String(formData.get("menuItemId") ?? "");
  const item = await assertMenuItemBelongsToVenue(menuItemId, venue.id);
  if (!item) return { error: "Menu item not found for this venue." };

  const groupId = String(formData.get("groupId") ?? "");
  if (!(await assertGroupBelongsToVenue(groupId, venue.id))) return { error: "Group not found for this venue." };

  const sequence = Number(formData.get("sequence") ?? 0);
  if (!Number.isFinite(sequence) || sequence < 1) return { error: "Step order must be 1 or higher." };

  try {
    await prisma.menuItemModifierGroup.create({ data: { menuItemId, groupId, sequence } });
  } catch {
    return { error: "That group is already a step on this item, or that step order is already taken - pick another." };
  }
  revalidatePath(`/admin/${venue.slug}/menus/${item.menuId}/items/${menuItemId}`);
}

export async function updateModifierGroupSequence(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuItemId = String(formData.get("menuItemId") ?? "");
  const item = await assertMenuItemBelongsToVenue(menuItemId, venue.id);
  if (!item) return { error: "Menu item not found for this venue." };

  const id = String(formData.get("id") ?? "");
  const sequence = Number(formData.get("sequence") ?? 0);
  if (!Number.isFinite(sequence) || sequence < 1) return { error: "Step order must be 1 or higher." };

  try {
    const result = await prisma.menuItemModifierGroup.updateMany({ where: { id, menuItemId }, data: { sequence } });
    if (result.count === 0) return { error: "Step not found." };
  } catch {
    return { error: "That step order is already taken by another step on this item." };
  }
  revalidatePath(`/admin/${venue.slug}/menus/${item.menuId}/items/${menuItemId}`);
}

export async function detachModifierGroupFromItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuItemId = String(formData.get("menuItemId") ?? "");
  const item = await assertMenuItemBelongsToVenue(menuItemId, venue.id);
  if (!item) return { error: "Menu item not found for this venue." };

  const id = String(formData.get("id") ?? "");
  const result = await prisma.menuItemModifierGroup.deleteMany({ where: { id, menuItemId } });
  if (result.count === 0) return { error: "Step not found." };
  revalidatePath(`/admin/${venue.slug}/menus/${item.menuId}/items/${menuItemId}`);
}
