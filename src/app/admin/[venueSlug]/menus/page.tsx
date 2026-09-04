import Link from "next/link";
import { Plus, UtensilsCrossed } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MenusPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const menus = await prisma.menu.findMany({
    where: { venueId: venue.id },
    orderBy: { name: "asc" },
    include: {
      bookingType: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Pre-order menus</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Menus customers choose items from at booking time, required for any booking type marked
            &quot;requires pre-order&quot;.
          </p>
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
    </div>
  );
}
