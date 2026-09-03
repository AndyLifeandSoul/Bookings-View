import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { AreaRow } from "./area-row";
import { DeleteTableButton } from "./delete-table-button";
import { DeleteLinkButton } from "./delete-link-button";
import { createArea, createTableLink } from "./actions";
import { naturalSortTables } from "@/lib/tables/natural-sort";

export const dynamic = "force-dynamic";

export default async function TablesPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [areas, tablesRaw, links] = await Promise.all([
    prisma.area.findMany({
      where: { venueId: venue.id },
      orderBy: { priority: "asc" },
      include: { _count: { select: { tables: true } } },
    }),
    // No orderBy — see naturalSortTables' doc comment (plain label:asc string
    // sort here would put "T10"/"T11" ahead of "T2"..."T9").
    prisma.table.findMany({
      where: { venueId: venue.id },
      include: { area: { select: { name: true } } },
    }),
    prisma.tableLink.findMany({
      where: { tableA: { venueId: venue.id } },
      include: { tableA: { select: { label: true } }, tableB: { select: { label: true } } },
    }),
  ]);
  const tables = naturalSortTables(tablesRaw);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-base font-semibold text-zinc-900">Areas</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Named groupings of tables — &quot;Downstairs&quot;, &quot;Terrace&quot;. Priority controls auto-assignment
          fill order: a lower number fills first, so bookings exhaust one area&apos;s capacity before spilling into
          the next.
        </p>

        {areas.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            {areas.map((area) => (
              <AreaRow
                key={area.id}
                id={area.id}
                venueId={venue.id}
                name={area.name}
                priority={area.priority}
                tableCount={area._count.tables}
              />
            ))}
          </div>
        )}

        <ActionForm
          action={createArea}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4"
        >
          <input type="hidden" name="venueId" value={venue.id} />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">New area name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Downstairs"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Priority</span>
            <input type="number" name="priority" defaultValue={0} className="w-28 rounded-md border border-zinc-300 px-3 py-2" />
          </label>
          <SubmitButton
            label="Add area"
            pendingLabel="Adding…"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          />
        </ActionForm>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Tables</h2>
            <p className="mt-1 text-sm text-zinc-500">
              What auto-assignment and the staff diary actually seat parties at.
            </p>
          </div>
          <Link
            href={`/admin/${venue.slug}/tables/new`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New table
          </Link>
        </div>

        {tables.length === 0 ? (
          <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
            No tables yet — auto-assignment has nothing to seat parties at until at least one exists.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Label</th>
                  <th className="px-4 py-2">Area</th>
                  <th className="px-4 py-2">Covers</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {tables.map((table) => (
                  <tr key={table.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-900">{table.label}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{table.area?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {table.minCovers}–{table.maxCovers}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          table.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {table.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/${venue.slug}/tables/${table.id}`}
                          className="text-sm text-zinc-600 underline hover:text-zinc-900"
                        >
                          Edit
                        </Link>
                        <DeleteTableButton id={table.id} label={table.label} venueId={venue.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Linked tables</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Physically adjacent tables that can be combined onto one booking, and that auto-assignment tries not to
          double-book side by side for two different parties when it has another option.
        </p>

        {links.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <tbody>
                {links.map((link) => (
                  <tr key={link.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-900">
                      {link.tableA.label} ↔ {link.tableB.label}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DeleteLinkButton id={link.id} venueId={venue.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tables.length >= 2 ? (
          <ActionForm
            action={createTableLink}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4"
          >
            <input type="hidden" name="venueId" value={venue.id} />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Table A</span>
              <select name="tableAId" required className="rounded-md border border-zinc-300 px-3 py-2">
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Table B</span>
              <select name="tableBId" required className="rounded-md border border-zinc-300 px-3 py-2">
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton
              label="Link tables"
              pendingLabel="Linking…"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            />
          </ActionForm>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Add at least two tables before linking any together.</p>
        )}
      </section>
    </div>
  );
}
