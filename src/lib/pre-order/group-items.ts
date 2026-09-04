export interface PreOrderLineForDisplay {
  quantity: number;
  guestLabel: string | null;
  notes: string | null;
  menuItem: {
    name: string;
    priceInPence: number;
    dietaryTags: string[];
    category: { id: string; name: string; sortOrder: number } | null;
  };
}

/**
 * Groups a PreOrder's flat item list by MenuCategory for display (the
 * booking details page and the print view both use this) - sorted in JS
 * rather than via a Prisma orderBy on the two-hop items -> menuItem ->
 * category relation chain, which isn't reliably expressible as a single
 * query ordering. Uncategorised items (a flat menu like Rumba's, see
 * MenuItem.categoryId's doc comment) sort last and render with no heading.
 */
export function groupPreOrderItems(
  items: PreOrderLineForDisplay[],
): { category: { id: string; name: string } | null; items: PreOrderLineForDisplay[] }[] {
  const sorted = [...items].sort((a, b) => {
    const aOrder = a.menuItem.category?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.menuItem.category?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.menuItem.name.localeCompare(b.menuItem.name);
  });

  const groups: { category: { id: string; name: string } | null; items: PreOrderLineForDisplay[] }[] = [];
  for (const item of sorted) {
    const categoryId = item.menuItem.category?.id ?? null;
    const last = groups.at(-1);
    if (last && (last.category?.id ?? null) === categoryId) {
      last.items.push(item);
    } else {
      groups.push({ category: item.menuItem.category, items: [item] });
    }
  }
  return groups;
}
