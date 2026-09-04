import Link from "next/link";
import { Plus, Armchair } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    // No orderBy, see naturalSortTables' doc comment (plain label:asc string
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
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Areas</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Named groupings of tables, &quot;Downstairs&quot;, &quot;Terrace&quot;. Priority controls auto-assignment
          fill order: a lower number fills first, so bookings exhaust one area&apos;s capacity before spilling into
          the next.
        </p>

        {areas.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
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
          </Card>
        )}

        <Card className="mt-4">
          <ActionForm action={createArea} className="flex flex-wrap items-end gap-3">
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
            <SubmitButton label="Add area" pendingLabel="Adding…" className={buttonStyles("primary", "md")} />
          </ActionForm>
        </Card>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Tables</h2>
            <p className="mt-1 text-sm text-zinc-500">
              What auto-assignment and the staff diary actually seat parties at.
            </p>
          </div>
          <Link href={`/admin/${venue.slug}/tables/new`} className={buttonStyles("primary", "sm")}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            New table
          </Link>
        </div>

        {tables.length === 0 ? (
          <Card className="mt-4 flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <Armchair className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-zinc-500">No tables yet. Auto-assignment has nothing to seat parties at until at least one exists.</p>
          </Card>
        ) : (
          <div className="mt-4 flex flex-col gap-5">
            {groupByArea(tables, areas).map(([areaName, groupTables]) => (
              <Card key={areaName} padded={false} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-4 py-2.5">
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-800">{areaName}</h3>
                  <span className="text-xs text-zinc-400">
                    {groupTables.length} {groupTables.length === 1 ? "table" : "tables"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-2">Label</th>
                        <th className="px-4 py-2">Covers</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {groupTables.map((table) => (
                        <tr key={table.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                          <td className="px-4 py-3 font-medium text-zinc-900">{table.label}</td>
                          <td className="px-4 py-3 tabular-nums text-zinc-600">
                            {table.minCovers}–{table.maxCovers}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={table.active ? "success" : "neutral"}>{table.active ? "Active" : "Inactive"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                href={`/admin/${venue.slug}/tables/${table.id}`}
                                className="text-sm font-medium text-zinc-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)]"
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
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Linked tables</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Physically adjacent tables that can be combined onto one booking, and that auto-assignment tries not to
          double-book side by side for two different parties when it has another option.
        </p>

        {links.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
            <table className="w-full text-left text-sm">
              <tbody>
                {links.map((link) => (
                  <tr key={link.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {link.tableA.label} ↔ {link.tableB.label}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteLinkButton id={link.id} venueId={venue.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tables.length >= 2 ? (
          <Card className="mt-4">
            <ActionForm action={createTableLink} className="flex flex-wrap items-end gap-3">
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
              <SubmitButton label="Link tables" pendingLabel="Linking…" className={buttonStyles("primary", "md")} />
            </ActionForm>
          </Card>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Add at least two tables before linking any together.</p>
        )}
      </section>
    </div>
  );
}

/**
 * Groups the already-natural-sorted table list by area name, in the same
 * priority order as the Areas section above (lower priority number first,
 * matching auto-assignment's own fill order) - the Area column each row
 * already showed becomes a section header instead, so a venue with 40+
 * tables reads as its physical layout rather than one long alphabetic
 * list. Tables with no area go in a trailing "No area" group, only shown
 * when at least one table actually has no area.
 */
function groupByArea<T extends { area: { name: string } | null }>(
  tables: T[],
  areas: { name: string; priority: number }[],
): [string, T[]][] {
  const orderedNames = [...areas].sort((a, b) => a.priority - b.priority).map((a) => a.name);
  const groups = new Map<string, T[]>();
  for (const table of tables) {
    const key = table.area?.name ?? "No area";
    const existing = groups.get(key);
    if (existing) existing.push(table);
    else groups.set(key, [table]);
  }
  const result: [string, T[]][] = [];
  for (const name of orderedNames) {
    const group = groups.get(name);
    if (group) result.push([name, group]);
  }
  const noArea = groups.get("No area");
  if (noArea) result.push(["No area", noArea]);
  return result;
}
