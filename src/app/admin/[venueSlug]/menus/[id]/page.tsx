import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createMenuItem, updateMenu } from "../actions";
import { MenuItemRow } from "../menu-item-row";
import { DeleteMenuButton } from "../delete-menu-button";

export const dynamic = "force-dynamic";

export default async function MenuDetailPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [menu, bookingTypes] = await Promise.all([
    prisma.menu.findFirst({
      where: { id, venueId: venue.id },
      include: { items: { orderBy: { name: "asc" } } },
    }),
    prisma.bookingType.findMany({
      where: { venueId: venue.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!menu) notFound();

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">{menu.name}</h2>
        <Card className="mt-3">
          <ActionForm action={updateMenu} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={menu.id} />
            <input type="hidden" name="venueId" value={venue.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Name</span>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={menu.name}
                  className="rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Linked booking type</span>
                <select
                  name="bookingTypeId"
                  defaultValue={menu.bookingTypeId ?? ""}
                  className="rounded-md border border-zinc-300 px-3 py-2"
                >
                  <option value="">Any</option>
                  {bookingTypes.map((bt) => (
                    <option key={bt.id} value={bt.id}>
                      {bt.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Description (optional)</span>
              <textarea
                name="description"
                defaultValue={menu.description ?? ""}
                rows={2}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={menu.active} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm font-medium text-zinc-700">Active</span>
            </label>
            <div className="flex items-center gap-4">
              <SubmitButton label="Save menu" pendingLabel="Saving…" className={buttonStyles("primary", "md")} />
            </div>
          </ActionForm>
        </Card>
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
                    <MenuItemRow key={item.id} item={item} menuId={menu.id} venueId={venue.id} />
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
