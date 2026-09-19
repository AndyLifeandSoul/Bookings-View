import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { Card } from "@/components/ui/card";
import { AttachItemsForm } from "./attach-items-form";
import { MenuItemPlacementRow } from "./menu-item-placement-row";
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

  const [menu, bookingTypes, categories, venueItems] = await Promise.all([
    prisma.menu.findFirst({
      where: { id, venueId: venue.id },
      include: {
        itemPlacements: {
          orderBy: [{ menuItem: { sortOrder: "asc" } }, { menuItem: { name: "asc" } }],
          include: {
            menuItem: {
              include: {
                modifierGroups: {
                  orderBy: { sequence: "asc" },
                  include: {
                    group: {
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        options: {
                          where: { active: true },
                          orderBy: { sortOrder: "asc" },
                          select: { id: true, name: true, description: true, priceDeltaPence: true },
                        },
                      },
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
    prisma.menuItem.findMany({
      where: { venueId: venue.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, categoryId: true },
    }),
  ]);
  if (!menu) notFound();

  // Which categories this menu currently offers (see MenuAvailableCategory's
  // doc comment in schema.prisma) - the Add item dropdown below only offers
  // existing venue items that fit one of these categories, or have no
  // category at all, so it can't put something on this menu that ends up in
  // a section the menu doesn't use.
  const availableCategoryIds = new Set(menu.availableCategories.map((a) => a.categoryId));

  const placedItems = menu.itemPlacements.map((placement) => placement.menuItem);
  const placedItemIds = new Set(placedItems.map((item) => item.id));

  const attachableItems = venueItems.filter(
    (item) => !placedItemIds.has(item.id) && (!item.categoryId || availableCategoryIds.has(item.categoryId)),
  );

  const previewItems = placedItems
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
        group: {
          id: attached.group.id,
          name: attached.group.name,
          description: attached.group.description,
          options: attached.group.options,
        },
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
        <p className="mt-1 text-sm text-zinc-500">
          Existing venue items placed on this menu. Item details themselves are typed once on the venue&apos;s Items
          section on the Menus page, not here.
        </p>
        {placedItems.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No items on this menu yet, add one below.</p>
        ) : (
          <Card padded={false} className="mt-2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Price</th>
                    <th className="px-4 py-2.5">Dietary tags</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {placedItems.map((item) => (
                    <MenuItemPlacementRow
                      key={item.id}
                      item={item}
                      menuId={menu.id}
                      venueId={venue.id}
                      venueSlug={venue.slug}
                      customisationStepCount={item.modifierGroups.length}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="mt-4">
          {attachableItems.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Every venue item that fits this menu&apos;s categories is already on it. Add a new item, or open up
              another category on this menu, from the venue&apos;s Items section on the Menus page.
            </p>
          ) : (
            <AttachItemsForm menuId={menu.id} venueId={venue.id} items={attachableItems} />
          )}
        </Card>
      </section>
    </div>
  );
}
