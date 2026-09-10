import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { attachModifierGroupToItem } from "../../../actions";
import { ItemModifierStepRow } from "./item-modifier-step-row";

export const dynamic = "force-dynamic";

/**
 * Manages which ModifierGroup steps (Toppings, Chip Variety, Cheese, ...)
 * an item's kiosk customisation wizard walks through, and in what order.
 * An item with no steps here has no wizard at all - the kiosk adds it
 * straight to the basket on tap (see MenuItemModifierGroup's doc comment
 * in schema.prisma). Groups themselves are built on the venue's Menus page
 * (shared across every item, like MenuCategory), this page only decides
 * which of them apply to this one item and in what sequence.
 */
export default async function ItemCustomisationPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string; itemId: string }>;
}) {
  const { venueSlug, id: menuId, itemId } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [item, allGroups] = await Promise.all([
    prisma.menuItem.findFirst({
      where: { id: itemId, menuId, menu: { venueId: venue.id } },
      include: {
        modifierGroups: {
          orderBy: { sequence: "asc" },
          include: { group: { select: { id: true, name: true, active: true } } },
        },
      },
    }),
    prisma.modifierGroup.findMany({
      where: { venueId: venue.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!item) notFound();

  const attachedGroupIds = new Set(item.modifierGroups.map((mig) => mig.groupId));
  const availableGroups = allGroups.filter((group) => !attachedGroupIds.has(group.id));
  const nextSequence = item.modifierGroups.length === 0 ? 1 : Math.max(...item.modifierGroups.map((mig) => mig.sequence)) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/${venue.slug}/menus/${menuId}`}
          className="text-sm font-medium text-zinc-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)]"
        >
          &larr; Back to menu
        </Link>
        <h2 className="mt-2 text-base font-semibold tracking-tight text-zinc-900">{item.name}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Customisation steps a customer walks through, in order, before this item is added to their basket. With
          none set up, tapping {item.name} in the kiosk adds it straight to the basket at its base price.
        </p>
      </div>

      {item.modifierGroups.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No steps yet - add one below.</p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          {item.modifierGroups.map((mig) => (
            <ItemModifierStepRow
              key={mig.id}
              id={mig.id}
              menuItemId={item.id}
              venueId={venue.id}
              groupName={mig.group.name}
              groupActive={mig.group.active}
              sequence={mig.sequence}
            />
          ))}
        </Card>
      )}

      <Card>
        {availableGroups.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Every active step at this venue is already attached to this item. Build another one on the Menus page
            first if you need more.
          </p>
        ) : (
          <ActionForm action={attachModifierGroupToItem} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="menuItemId" value={item.id} />
            <input type="hidden" name="venueId" value={venue.id} />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Step</span>
              <select name="groupId" defaultValue="" required className="w-48 rounded-md border border-zinc-300 px-3 py-2">
                <option value="" disabled>
                  Choose a step
                </option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Order</span>
              <input
                type="number"
                name="sequence"
                min={1}
                defaultValue={nextSequence}
                className="w-24 rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <SubmitButton label="Add step" pendingLabel="Adding…" className={buttonStyles("primary", "md")} />
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
