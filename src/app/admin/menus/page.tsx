import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";

export const dynamic = "force-dynamic";

export default async function MenusPage() {
  const session = await requireAdminSession();

  const menus = await prisma.menu.findMany({
    where: { venueId: session.venueId },
    orderBy: { name: "asc" },
    include: {
      bookingType: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Pre-order menus</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Menus customers choose items from at booking time — required for any booking type marked
            &quot;requires pre-order&quot;.
          </p>
        </div>
        <Link
          href="/admin/menus/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New menu
        </Link>
      </div>

      {menus.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">No menus yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Linked booking type</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {menus.map((menu) => (
                <tr key={menu.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">{menu.name}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{menu.bookingType?.name ?? "Any"}</td>
                  <td className="px-4 py-2.5">{menu._count.items}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        menu.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {menu.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/menus/${menu.id}`} className="text-sm text-zinc-600 underline hover:text-zinc-900">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
