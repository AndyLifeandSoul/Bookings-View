import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createMenuItem } from "../actions";
import { MenuItemRow } from "../menu-item-row";
import { DeleteMenuButton } from "../delete-menu-button";
import { EditMenuForm } from "./edit-menu-form";

export const dynamic = "force-dynamic";

export default async function MenuDetailPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [menu, bookingTypes, categories] = await Promise.all([
    prisma.menu.findFirst({
      where: { id, venueId: venue.id },
      include: {
        items: {
          orderBy: { name: "asc" },
          include: {
            modifierGroups: {
              orderBy: { sequence: "asc" },
              include: {
                group: {
                  select: {
                    id: true,
                    name: true,
                    options: {
                      where: { active: true },
                      orderBy: { sortOrder: "asc" },
                      select: { id: true, name: true, priceDeltaPence: true },
                    },
                  },
                },
              },
            },
          },
        },
        availableCategories: { select: { categoryId: true } },
      },
    }),
    prisma.bookingType.findMany({
      where: { venueId: venue.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.menuCategory.findMany({
      where: { venueId: venue.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!menu) notFound();

  // Which categories this menu currently offers (see MenuAvailableCategory's
  // doc comment in schema.prisma) - this is what the Add item / per-item
  // category dropdowns are scoped to below, not the venue's full list, so
  // an item can't be miscategorised into a section this menu doesn't use.
  const availableCategoryIds = new Set(menu.availableCategories.map((a) => a.categoryId));
  const availableCategories = categories.filter((category) => availableCategoryIds.has(category.id));

  // An item already assigned to a category that's since been unticked for
  // this menu keeps showing that category as an option on its own row
  // (just not offered for anything else) - narrowing a menu's categories
  // should never silently blank out or revert an existing item's data.
  function categoriesForItem(itemCategoryId: string | null) {
    if (!itemCategoryId || availableCategoryIds.has(itemCategoryId)) return availableCategories;
    const orphan = categories.find((category) => category.id === itemCategoryId);
    return orphan ? [...availableCategories, orphan] : availableCategories;
  }

  const previewItems = menu.items
    .filter((item) => item.active)
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      priceInPence: item.priceInPence,
      dietaryTags: item.dietaryTags,
      categoryId: item.categoryId,
      modifierGroups: item.modifierGroups.map((attached) => ({
        sequence: attached.sequence,
        group: { id: attached.group.id, name: attached.group.name, options: attached.group.options },
      })),
    }));

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">{menu.name}</h2>
        <div className="mt-3">
          <EditMenuForm
            menuId={menu.id}
            venueId={venue.id}
            name={menu.name}
            description={menu.description}
            active={menu.active}
            bookingTypeId={menu.bookingTypeId}
            bookingTypes={bookingTypes}
            categories={categories}
            availableCategoryIds={[...availableCategoryIds]}
            items={previewItems}
          />
        </div>
        <DeleteMenuButton id={menu.id} name={menu.name} venueId={venue.id} />
      </section>

      <section>
        <h3 className="text-sm font-semibold tracking-tight text-zinc-900">Items</h3>
        {menu.items.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No items yet, add one below.</p>
        ) : (
          <Card padded={false} className="mt-2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <tbody>
                  {menu.items.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      menuId={menu.id}
                      venueId={venue.id}
                      venueSlug={venue.slug}
                      categories={categoriesForItem(item.categoryId)}
                      customisationStepCount={item.modifierGroups.length}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="mt-4">
          <ActionForm action={createMenuItem} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="menuId" value={menu.id} />
            <input type="hidden" name="venueId" value={venue.id} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Name</span>
              <input
                type="text"
                name="name"
                required
                placeholder="Fish & chips"
                className="w-44 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Description</span>
              <input type="text" name="description" className="w-56 rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Price (£)</span>
              <input
                type="number"
                name="pricePounds"
                min={0}
                step={0.01}
                required
                className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Dietary tags</span>
              <input
                type="text"
                name="dietaryTags"
                placeholder="vegetarian, gf"
                className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Category</span>
              <select name="categoryId" defaultValue="" className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                <option value="">Uncategorised</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 pb-1.5">
              <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-xs font-medium text-zinc-500">Active</span>
            </label>
            <SubmitButton label="Add item" pendingLabel="Adding…" className={buttonStyles("primary", "sm")} />
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
