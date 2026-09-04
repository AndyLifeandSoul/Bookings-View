import Link from "next/link";
import { Plus, UtensilsCrossed } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MenuCategoryRow } from "./menu-category-row";
import { createMenuCategory } from "./actions";

export const dynamic = "force-dynamic";

export default async function MenusPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [menus, categories] = await Promise.all([
    prisma.menu.findMany({
      where: { venueId: venue.id },
      orderBy: { name: "asc" },
      include: {
        bookingType: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.menuCategory.findMany({
      where: { venueId: venue.id },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Categories</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Shared across every menu at this venue - e.g. a Starters category applies the same way whether it is on
          the standard pre-order menu or a Christmas one.
        </p>

        {categories.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
            {categories.map((category) => (
              <MenuCategoryRow
                key={category.id}
                id={category.id}
                venueId={venue.id}
                name={category.name}
                sortOrder={category.sortOrder}
                itemCount={category._count.items}
              />
            ))}
          </Card>
        )}

        <Card className="mt-4">
          <ActionForm action={createMenuCategory} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="venueId" value={venue.id} />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">New category name</span>
              <input
                type="text"
                name="name"
                required
                placeholder="Starters"
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Order</span>
              <input type="number" name="sortOrder" defaultValue={0} className="w-28 rounded-md border border-zinc-300 px-3 py-2" />
            </label>
            <SubmitButton label="Add category" pendingLabel="Adding…" className={buttonStyles("primary", "md")} />
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Pre-order menus</h2>
          </div>
          <Link href={`/admin/${venue.slug}/menus/new`} className={buttonStyles("primary", "sm")}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            New menu
          </Link>
        </div>

        {menus.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <UtensilsCrossed className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-zinc-500">No menus yet.</p>
          </Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Linked booking type</th>
                    <th className="px-4 py-2.5">Items</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {menus.map((menu) => (
                    <tr key={menu.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">{menu.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{menu.bookingType?.name ?? "Any"}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-600">{menu._count.items}</td>
                      <td className="px-4 py-3">
                        <Badge variant={menu.active ? "success" : "neutral"}>{menu.active ? "Active" : "Inactive"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/${venue.slug}/menus/${menu.id}`}
                          className="text-sm font-medium text-zinc-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)]"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
