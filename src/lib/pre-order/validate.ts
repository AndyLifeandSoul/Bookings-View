// MIRRORED FILE, NOT CANONICAL. This is a straight copy of
// lifeandsoul-bookings' src/lib/pre-order/validate.ts, used here so
// bookings-view's staff quick-add (see addPreOrderItems in the booking
// details actions.ts) can validate and price full item + modifier
// selections against the database the same way the customer-facing
// booking flow and the staff-invite token flow both do, rather than
// re-implementing a second, possibly-diverging copy of this logic. When
// this changes, change it in `lifeandsoul-bookings` first, then copy the
// result here.

import { prisma } from "@/lib/db/client";

export interface PreOrderModifierInput {
  groupId: string;
  optionId: string;
}

export interface PreOrderLineInput {
  menuItemId: string;
  quantity: number;
  modifiers: PreOrderModifierInput[];
}

export interface PreparedPreOrderModifier {
  optionId: string;
  sequence: number;
  groupNameSnapshot: string;
  optionNameSnapshot: string;
  priceDeltaPenceSnapshot: number;
}

export interface PreparedPreOrderLine {
  menuItemId: string;
  quantity: number;
  modifiers: PreparedPreOrderModifier[];
  /** Base item price plus every modifier's price delta, pence, for one unit. */
  unitPriceInPence: number;
}

/**
 * Thrown for anything wrong with a pre-order submission - a missing item,
 * a stale price, an over-the-limit basket. Always safe to show `.message`
 * directly to whoever submitted it (a customer via the widget, or staff
 * via the quick-add form here).
 */
export class InvalidPreOrderError extends Error {}

/**
 * Re-validates a pre-order basket against the database. Nothing about
 * pricing or availability is ever trusted from the caller: every menu
 * item, its modifier groups/options, and their prices are always looked
 * up here fresh.
 *
 * `categoryIds`: pass a staff invite's restricted category list to only
 * allow items in those categories; pass null/undefined for no restriction
 * beyond "on this menu at all" (bookings-view's staff quick-add always
 * passes null - staff can add anything on the menu, there's no
 * category-curation step for this path).
 *
 * Throws InvalidPreOrderError on any problem. Returns the prepared lines
 * (ready to write as PreOrderItem/PreOrderItemModifier rows) plus the
 * total price in pence, for callers that need to charge for it.
 */
export async function validateAndPricePreOrder(params: {
  menuId: string;
  categoryIds?: string[] | null;
  maxItemsPerPerson: number | null;
  partySize: number;
  items: PreOrderLineInput[];
}): Promise<{ lines: PreparedPreOrderLine[]; totalInPence: number }> {
  if (params.items.length === 0) {
    throw new InvalidPreOrderError("Choose at least one item.");
  }

  // Parse and validate the shape of each line, merging lines that request
  // the exact same item with the exact same customisation selections, so
  // a caller sending duplicate lines can't create duplicate PreOrderItem
  // rows.
  type ParsedLine = { menuItemId: string; quantity: number; optionIdsByGroup: Map<string, string> };
  const lines = new Map<string, ParsedLine>();

  for (const raw of params.items) {
    const menuItemId = String(raw?.menuItemId ?? "");
    const quantity = Math.trunc(Number(raw?.quantity));
    if (!menuItemId || !Number.isFinite(quantity) || quantity < 1) {
      throw new InvalidPreOrderError("Invalid item selection.");
    }
    const rawModifiers = Array.isArray(raw?.modifiers) ? raw.modifiers : [];
    const optionIdsByGroup = new Map<string, string>();
    for (const rawModifier of rawModifiers) {
      const groupId = String((rawModifier as Partial<PreOrderModifierInput> | undefined)?.groupId ?? "");
      const optionId = String((rawModifier as Partial<PreOrderModifierInput> | undefined)?.optionId ?? "");
      if (!groupId || !optionId) {
        throw new InvalidPreOrderError("Invalid customisation selection.");
      }
      if (optionIdsByGroup.has(groupId)) {
        throw new InvalidPreOrderError("Only one choice is allowed per customisation step.");
      }
      optionIdsByGroup.set(groupId, optionId);
    }
    const key = `${menuItemId}::${[...optionIdsByGroup.values()].sort().join(",")}`;
    const existing = lines.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      lines.set(key, { menuItemId, quantity, optionIdsByGroup });
    }
  }
  if (lines.size === 0) {
    throw new InvalidPreOrderError("Choose at least one item.");
  }

  // Null means no cap on this menu; when set, the effective cap for this
  // booking scales with its party size (see Menu.maxItemsPerPerson's doc
  // comment in schema.prisma) and applies to the total quantity across
  // every line, not any single item.
  if (params.maxItemsPerPerson != null) {
    const totalQuantity = [...lines.values()].reduce((sum, line) => sum + line.quantity, 0);
    const limit = params.maxItemsPerPerson * params.partySize;
    if (totalQuantity > limit) {
      throw new InvalidPreOrderError(`This order is limited to ${limit} item(s) in total.`);
    }
  }

  const menuItemIds = [...new Set([...lines.values()].map((line) => line.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, menuPlacements: { some: { menuId: params.menuId } }, active: true },
    select: {
      id: true,
      categoryId: true,
      priceInPence: true,
      modifierGroups: {
        select: {
          groupId: true,
          sequence: true,
          group: {
            select: {
              name: true,
              active: true,
              options: { select: { id: true, name: true, priceDeltaPence: true, active: true } },
            },
          },
        },
      },
    },
  });
  if (menuItems.length !== menuItemIds.length) {
    throw new InvalidPreOrderError("One or more items are no longer available.");
  }
  if (params.categoryIds) {
    const categoryIds = params.categoryIds;
    const notVisible = menuItems.some((item) => item.categoryId && !categoryIds.includes(item.categoryId));
    if (notVisible) {
      throw new InvalidPreOrderError("One or more items aren't part of this pre-order.");
    }
  }
  const menuItemsById = new Map(menuItems.map((item) => [item.id, item]));

  // Validate each line's customisation selections against what's actually
  // attached to that item (every required step covered, no extras, and
  // each choice a live active option of the right step), then build the
  // snapshot values PreOrderItemModifier stores - always from this
  // lookup, never from anything the caller sent.
  const preparedLines: PreparedPreOrderLine[] = [];
  let totalInPence = 0;

  for (const line of lines.values()) {
    const menuItem = menuItemsById.get(line.menuItemId);
    if (!menuItem) {
      throw new InvalidPreOrderError("One or more items are no longer available.");
    }
    const requiredGroupIds = new Set(menuItem.modifierGroups.map((attached) => attached.groupId));
    const providedGroupIds = new Set(line.optionIdsByGroup.keys());
    const coversExactly =
      requiredGroupIds.size === providedGroupIds.size && [...requiredGroupIds].every((groupId) => providedGroupIds.has(groupId));
    if (!coversExactly) {
      throw new InvalidPreOrderError("One or more items are missing a required customisation.");
    }

    const modifiers: PreparedPreOrderModifier[] = [];
    let unitPriceInPence = menuItem.priceInPence;
    for (const attached of menuItem.modifierGroups) {
      const optionId = line.optionIdsByGroup.get(attached.groupId);
      const option = attached.group.active ? attached.group.options.find((candidate) => candidate.id === optionId && candidate.active) : undefined;
      if (!option) {
        throw new InvalidPreOrderError("One or more customisation choices are no longer available.");
      }
      modifiers.push({
        optionId: option.id,
        sequence: attached.sequence,
        groupNameSnapshot: attached.group.name,
        optionNameSnapshot: option.name,
        priceDeltaPenceSnapshot: option.priceDeltaPence,
      });
      unitPriceInPence += option.priceDeltaPence;
    }
    preparedLines.push({ menuItemId: line.menuItemId, quantity: line.quantity, modifiers, unitPriceInPence });
    totalInPence += unitPriceInPence * line.quantity;
  }

  return { lines: preparedLines, totalInPence };
}
