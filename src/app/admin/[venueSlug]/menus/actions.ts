"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import type { ActionResult } from "@/components/action-form";

/** venueId comes from a hidden form field (set from the page's route param) - admin sessions are venue-independent, see requireAdminVenue(). */
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

/**
 * MenuAvailableCategory rows a create/update menu submission should end up
 * with - every checked box in the form's category selector, validated
 * against this venue so a stray/forged id can't attach a category from
 * somewhere else. An empty selection is valid (staff can deliberately
 * uncheck everything), it just means the menu offers no categorised
 * sections yet - MenuItem.categoryId stays nullable regardless, so
 * uncategorised items are unaffected either way.
 */
async function resolveSelectedCategories(formData: FormData, venueId: string): Promise<string[] | { error: string }> {
  const requestedIds = [...new Set(formData.getAll("categoryIds").map((value) => String(value)))];
  if (requestedIds.length === 0) return [];
  const owned = await prisma.menuCategory.findMany({ where: { id: { in: requestedIds }, venueId }, select: { id: true } });
  if (owned.length !== requestedIds.length) return { error: "One or more categories don't belong to this venue." };
  return requestedIds;
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

  const categoryIds = await resolveSelectedCategories(formData, venue.id);
  if ("error" in categoryIds) return categoryIds;

  const menu = await prisma.menu.create({
    data: {
      venueId: venue.id,
      ...parsed,
      availableCategories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });
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

  const categoryIds = await resolveSelectedCategories(formData, venue.id);
  if ("error" in categoryIds) return categoryIds;

  const existing = await prisma.menu.findFirst({ where: { id, venueId: venue.id }, select: { id: true } });
  if (!existing) return { error: "Menu not found for this venue." };

  await prisma.$transaction([
    prisma.menu.update({ where: { id }, data: parsed }),
    prisma.menuAvailableCategory.deleteMany({ where: { menuId: id } }),
    prisma.menuAvailableCategory.createMany({ data: categoryIds.map((categoryId) => ({ menuId: id, categoryId })) }),
  ]);

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

  // Deleting the menu cascades to its MenuItemPlacement rows (onDelete:
  // Cascade in schema) - the venue's MenuItems themselves, and their
  // placements on any other menu, are untouched.
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
 * No blocking check before delete, unlike deleteMenu/deleteItem: a
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

// ---------------------------------------------------------------------------
// Items (MenuItem is venue-scoped, see schema.prisma's doc comment on that
// model) - name/description/price/dietary tags/category are all typed here
// and only here. Which menus offer a given item is managed separately, see
// attachItemsToMenu/detachItemFromMenu below.
// ---------------------------------------------------------------------------

export async function createItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;

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
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  await prisma.menuItem.create({
    data: {
      venueId: venue.id,
      categoryId,
      name,
      description,
      active,
      priceInPence: priceOrError,
      dietaryTags: parseDietaryTags(formData),
      sortOrder,
    },
  });
  revalidatePath(`/admin/${venue.slug}/menus`);
}

export async function updateItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

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
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  const result = await prisma.menuItem.updateMany({
    where: { id, venueId: venue.id },
    data: { name, description, active, categoryId, priceInPence: priceOrError, dietaryTags: parseDietaryTags(formData), sortOrder },
  });
  if (result.count === 0) return { error: "Item not found for this venue." };

  revalidatePath(`/admin/${venue.slug}/menus`);
}

/**
 * Deactivates instead of deleting when the item is on any historical
 * pre-order, same reasoning as deleteMenu - a past order's PreOrderItem
 * still points at it (ON DELETE RESTRICT, see schema.prisma), so it can
 * never be hard-deleted from under that history anyway. Deleting it
 * outright also cascades to every MenuItemPlacement row for it (onDelete:
 * Cascade), taking it off every menu it was on, not just one.
 */
export async function deleteItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const id = String(formData.get("id") ?? "");

  const item = await prisma.menuItem.findFirst({ where: { id, venueId: venue.id }, select: { name: true } });
  if (!item) return { error: "Item not found for this venue." };

  const preOrderItemCount = await prisma.preOrderItem.count({ where: { menuItemId: id } });
  if (preOrderItemCount > 0) {
    await prisma.menuItem.updateMany({ where: { id, venueId: venue.id }, data: { active: false } });
    revalidatePath(`/admin/${venue.slug}/menus`);
    return {
      error: `"${item.name}" is on ${preOrderItemCount} existing pre-order(s), so it can't be deleted, deactivated instead.`,
    };
  }

  await prisma.menuItem.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath(`/admin/${venue.slug}/menus`);
}

async function assertMenuBelongsToVenue(menuId: string, venueId: string): Promise<boolean> {
  const menu = await prisma.menu.findFirst({ where: { id: menuId, venueId }, select: { id: true } });
  return Boolean(menu);
}

/**
 * Puts one or more existing venue items on a menu in a single submit. This,
 * and detachItemFromMenu, are the only way items land on or leave a menu
 * now - nothing about the item itself (name, price, description, ...) is
 * typed here, staff just tick items from the venue's existing list (see
 * MenuItemPlacement's doc comment in schema.prisma). Building a brand new
 * menu used to mean one submit per item, which is exactly what this
 * batches - skipDuplicates means a stale checkbox for something already
 * added (e.g. by another admin) between page load and submit is silently
 * ignored rather than failing the whole batch.
 */
export async function attachItemsToMenu(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuId = String(formData.get("menuId") ?? "");
  if (!(await assertMenuBelongsToVenue(menuId, venue.id))) {
    return { error: "Menu not found for this venue." };
  }

  const requestedIds = [...new Set(formData.getAll("menuItemIds").map((value) => String(value)))];
  if (requestedIds.length === 0) return { error: "Choose at least one item to add." };

  const owned = await prisma.menuItem.findMany({ where: { id: { in: requestedIds }, venueId: venue.id }, select: { id: true } });
  if (owned.length !== requestedIds.length) return { error: "One or more items don't belong to this venue." };

  await prisma.menuItemPlacement.createMany({
    data: owned.map((item) => ({ menuId, menuItemId: item.id })),
    skipDuplicates: true,
  });
  revalidatePath(`/admin/${venue.slug}/menus/${menuId}`);
}

/**
 * Takes an item off this one menu - the item itself, and any other menu
 * it's on, is untouched (see MenuItemPlacement's doc comment).
 */
export async function detachItemFromMenu(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuId = String(formData.get("menuId") ?? "");
  if (!(await assertMenuBelongsToVenue(menuId, venue.id))) {
    return { error: "Menu not found for this venue." };
  }

  const menuItemId = String(formData.get("menuItemId") ?? "");
  const result = await prisma.menuItemPlacement.deleteMany({ where: { menuId, menuItemId } });
  if (result.count === 0) return { error: "That item isn't on this menu." };
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
  const description = String(formData.get("description") ?? "").trim() || null;

  try {
    await prisma.modifierGroup.create({ data: { venueId: venue.id, name, description } });
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
  const description = String(formData.get("description") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  try {
    const result = await prisma.modifierGroup.updateMany({ where: { id, venueId: venue.id }, data: { name, description, active } });
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
  const description = String(formData.get("description") ?? "").trim() || null;
  const priceDeltaOrError = parsePriceDeltaToPence(formData);
  if (typeof priceDeltaOrError !== "number") return priceDeltaOrError;
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  try {
    await prisma.modifierOption.create({
      data: { groupId, name, description, priceDeltaPence: priceDeltaOrError, sortOrder },
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
  const description = String(formData.get("description") ?? "").trim() || null;
  const priceDeltaOrError = parsePriceDeltaToPence(formData);
  if (typeof priceDeltaOrError !== "number") return priceDeltaOrError;
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
  const active = formData.get("active") === "on";

  try {
    const result = await prisma.modifierOption.updateMany({
      where: { id, groupId },
      data: { name, description, priceDeltaPence: priceDeltaOrError, sortOrder, active },
    });
    if (result.count === 0) return { error: "Option not found." };
  } catch {
    return { error: `"${name}" already exists in this group.` };
  }
  revalidatePath(`/admin/${venue.slug}/menus`);
}

/**
 * Always safe to delete outright, unlike menus/items: a historical
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

async function assertMenuItemBelongsToVenue(menuItemId: string, venueId: string): Promise<boolean> {
  const item = await prisma.menuItem.findFirst({ where: { id: menuItemId, venueId }, select: { id: true } });
  return Boolean(item);
}

export async function attachModifierGroupToItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuItemId = String(formData.get("menuItemId") ?? "");
  if (!(await assertMenuItemBelongsToVenue(menuItemId, venue.id))) return { error: "Menu item not found for this venue." };

  const groupId = String(formData.get("groupId") ?? "");
  if (!(await assertGroupBelongsToVenue(groupId, venue.id))) return { error: "Group not found for this venue." };

  const sequence = Number(formData.get("sequence") ?? 0);
  if (!Number.isFinite(sequence) || sequence < 1) return { error: "Step order must be 1 or higher." };

  try {
    await prisma.menuItemModifierGroup.create({ data: { menuItemId, groupId, sequence } });
  } catch {
    return { error: "That group is already a step on this item, or that step order is already taken - pick another." };
  }
  // menuId is just which menu the staff member navigated from to reach this
  // item's customisation page (the route's [id] segment) - items are
  // venue-scoped now, not menu-scoped, so this only tells us which page to
  // revalidate, not which menu the item "belongs" to.
  const menuId = String(formData.get("menuId") ?? "");
  revalidatePath(`/admin/${venue.slug}/menus/${menuId}/items/${menuItemId}`);
}

export async function updateModifierGroupSequence(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuItemId = String(formData.get("menuItemId") ?? "");
  if (!(await assertMenuItemBelongsToVenue(menuItemId, venue.id))) return { error: "Menu item not found for this venue." };

  const id = String(formData.get("id") ?? "");
  const sequence = Number(formData.get("sequence") ?? 0);
  if (!Number.isFinite(sequence) || sequence < 1) return { error: "Step order must be 1 or higher." };

  try {
    const result = await prisma.menuItemModifierGroup.updateMany({ where: { id, menuItemId }, data: { sequence } });
    if (result.count === 0) return { error: "Step not found." };
  } catch {
    return { error: "That step order is already taken by another step on this item." };
  }
  const menuId = String(formData.get("menuId") ?? "");
  revalidatePath(`/admin/${venue.slug}/menus/${menuId}/items/${menuItemId}`);
}

export async function detachModifierGroupFromItem(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const venue = await resolveVenue(formData);
  if ("error" in venue) return venue;
  const menuItemId = String(formData.get("menuItemId") ?? "");
  if (!(await assertMenuItemBelongsToVenue(menuItemId, venue.id))) return { error: "Menu item not found for this venue." };

  const id = String(formData.get("id") ?? "");
  const result = await prisma.menuItemModifierGroup.deleteMany({ where: { id, menuItemId } });
  if (result.count === 0) return { error: "Step not found." };
  const menuId = String(formData.get("menuId") ?? "");
  revalidatePath(`/admin/${venue.slug}/menus/${menuId}/items/${menuItemId}`);
}
