import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AreaRow } from "./area-row";
import { DeleteAreaClosureButton } from "./delete-area-closure-button";
import { createArea, createTableLink, unlinkTableGroup, addAreaClosure, reorderAreas } from "./actions";
import { SortableList } from "@/components/sortable-list";
import { naturalSortTables } from "@/lib/tables/natural-sort";
import { TablesGrid, type GridTable } from "./tables-grid";
import { DateFieldSelect } from "@/components/date-field-select";

export const dynamic = "force-dynamic";

type LinkedRow = {
  tableAId: string;
  tableBId: string;
  tableA: { label: string };
  tableB: { label: string };
};

/**
 * Collapse the pairwise TableLink rows into connected groups, so a set of
 * tables all linked together shows as one "T1 + T2 + T3" row rather than
 * every underlying pair. Members and groups are ordered by the natural
 * table order (orderIndex).
 */
function groupLinkedTables(links: LinkedRow[], orderIndex: Map<string, number>): { ids: string[]; labels: string[] }[] {
  const adjacency = new Map<string, Set<string>>();
  const labelOf = new Map<string, string>();
  for (const link of links) {
    labelOf.set(link.tableAId, link.tableA.label);
    labelOf.set(link.tableBId, link.tableB.label);
    if (!adjacency.has(link.tableAId)) adjacency.set(link.tableAId, new Set());
    if (!adjacency.has(link.tableBId)) adjacency.set(link.tableBId, new Set());
    adjacency.get(link.tableAId)!.add(link.tableBId);
    adjacency.get(link.tableBId)!.add(link.tableAId);
  }

  const seen = new Set<string>();
  const groups: { ids: string[]; labels: string[] }[] = [];
  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const node = stack.pop()!;
      component.push(node);
      for (const neighbour of adjacency.get(node) ?? []) {
        if (!seen.has(neighbour)) {
          seen.add(neighbour);
          stack.push(neighbour);
        }
      }
    }
    component.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
    groups.push({ ids: component, labels: component.map((id) => labelOf.get(id) ?? "?") });
  }
  groups.sort((a, b) => (orderIndex.get(a.ids[0]) ?? 0) - (orderIndex.get(b.ids[0]) ?? 0));
  return groups;
}

/** Group tables under their area name (or "Other") for the link picker. */
function groupTablesByArea(
  tables: { id: string; label: string; area: { name: string } | null }[],
): { areaName: string; tables: { id: string; label: string }[] }[] {
  const groups: { areaName: string; tables: { id: string; label: string }[] }[] = [];
  for (const table of tables) {
    const name = table.area?.name ?? "Other";
    const existing = groups.find((g) => g.areaName === name);
    const entry = { id: table.id, label: table.label };
    if (existing) existing.tables.push(entry);
    else groups.push({ areaName: name, tables: [entry] });
  }
  return groups;
}

export default async function TablesPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [areas, tablesRaw, links, closures] = await Promise.all([
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
    prisma.areaClosure.findMany({
      where: { area: { venueId: venue.id } },
      include: { area: { select: { name: true } } },
      orderBy: { dateFrom: "asc" },
    }),
  ]);
  const gridTables: GridTable[] = naturalSortTables(tablesRaw)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({ id: t.id, label: t.label, areaId: t.areaId, minCovers: t.minCovers, maxCovers: t.maxCovers, active: t.active }));

  const orderIndex = new Map(gridTables.map((t, i) => [t.id, i] as const));
  const linkGroups = groupLinkedTables(links, orderIndex);
  const linkPickerGroups = groupTablesByArea(naturalSortTables(tablesRaw));

  const today = new Date();
  const todayDateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const upcomingClosures = closures.filter((c) => c.dateTo >= todayDateOnly);
  const pastClosures = closures.filter((c) => c.dateTo < todayDateOnly);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Areas</h2>

        {areas.length > 0 && (
          <>
            <p className="mt-1 text-sm text-zinc-500">Drag to set the fill order (tables in the first area are filled first).</p>
            <Card padded={false} className="mt-3 overflow-hidden">
              <SortableList
                items={areas.map((area) => ({
                  id: area.id,
                  content: (
                    <AreaRow id={area.id} venueId={venue.id} name={area.name} tableCount={area._count.tables} />
                  ),
                }))}
                reorder={reorderAreas.bind(null, venue.id)}
              />
            </Card>
          </>
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
            <SubmitButton label="Add area" pendingLabel="Adding…" className={buttonStyles("primary", "md")} />
          </ActionForm>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Area closures</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Close every table in an area for a date range, e.g. the Terrace reserved for a private function, or an
          area shut for refurbishment. Bookings can still be offered as normal using any other area.
        </p>

        {areas.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Add an area above before you can close one for a date range.</p>
        ) : (
          <>
            {upcomingClosures.length > 0 && (
              <Card padded={false} className="mt-4 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5">Area</th>
                      <th className="px-4 py-2.5">Dates</th>
                      <th className="px-4 py-2.5">Note</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingClosures.map((closure) => (
                      <tr key={closure.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                        <td className="px-4 py-3 font-medium text-zinc-900">{closure.area.name}</td>
                        <td className="px-4 py-3">{formatDateRange(closure.dateFrom, closure.dateTo)}</td>
                        <td className="px-4 py-3 text-zinc-500">{closure.note ?? "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <DeleteAreaClosureButton id={closure.id} venueId={venue.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            <Card className="mt-4">
              <ActionForm action={addAreaClosure} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <input type="hidden" name="venueId" value={venue.id} />
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">Area</span>
                  <select name="areaId" required className="rounded-md border border-zinc-300 px-3 py-2">
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">Start date</span>
                  <DateFieldSelect name="dateFrom" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">End date</span>
                  <DateFieldSelect name="dateTo" />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">Note (optional)</span>
                  <input
                    type="text"
                    name="note"
                    placeholder="e.g. Private function"
                    className="rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
                <SubmitButton label="Close area" pendingLabel="Saving…" className={buttonStyles("primary", "md")} />
              </ActionForm>
            </Card>

            {pastClosures.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-700">
                  {pastClosures.length} past closure{pastClosures.length === 1 ? "" : "s"}
                </summary>
                <Card padded={false} className="mt-2 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {pastClosures.map((closure) => (
                        <tr key={closure.id} className="border-b border-zinc-50 last:border-0">
                          <td className="px-4 py-3 font-medium text-zinc-900">{closure.area.name}</td>
                          <td className="px-4 py-3 text-zinc-500">{formatDateRange(closure.dateFrom, closure.dateTo)}</td>
                          <td className="px-4 py-3 text-zinc-500">{closure.note ?? "-"}</td>
                          <td className="px-4 py-3 text-right">
                            <DeleteAreaClosureButton id={closure.id} venueId={venue.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </details>
            )}
          </>
        )}
      </section>

      <section>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Tables</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Edit every table inline, drag the handle to reorder, then Save. Zone is the area used for fill priority.
          </p>
        </div>
        <div className="mt-4">
          <TablesGrid venueId={venue.id} areas={areas.map((a) => ({ id: a.id, name: a.name }))} tables={gridTables} />
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Linked tables</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tables that can be pushed together for one booking. Pick every table in a group and link them in one go, so a larger party can be seated across all of them.
        </p>

        {linkGroups.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
            <table className="w-full text-left text-sm">
              <tbody>
                {linkGroups.map((group) => (
                  <tr key={group.ids.join("-")} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                    <td className="px-4 py-3 font-medium text-zinc-900">{group.labels.join(" + ")}</td>
                    <td className="px-4 py-3 text-right">
                      <ActionForm action={unlinkTableGroup} className="inline-flex">
                        <input type="hidden" name="venueId" value={venue.id} />
                        {group.ids.map((id) => (
                          <input key={id} type="hidden" name="tableIds" value={id} />
                        ))}
                        <SubmitButton
                          label="Unlink"
                          pendingLabel="Removing…"
                          className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50"
                        />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {gridTables.length >= 2 ? (
          <Card className="mt-4">
            <ActionForm action={createTableLink} className="flex flex-col gap-3">
              <input type="hidden" name="venueId" value={venue.id} />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">Tables to link together</span>
                <div className="rounded-md border border-zinc-300 p-2">
                  {linkPickerGroups.map((areaGroup) => (
                    <div key={areaGroup.areaName} className="mb-2 last:mb-0">
                      <p className="px-1 text-xs font-semibold uppercase text-zinc-400">{areaGroup.areaName}</p>
                      <div className="flex flex-wrap gap-1.5 p-1">
                        {areaGroup.tables.map((table) => (
                          <label
                            key={table.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-300 px-2 py-1 text-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]"
                          >
                            <input type="checkbox" name="tableIds" value={table.id} className="h-4 w-4 rounded border-zinc-300" />
                            {table.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">Pick two or more. Every table you select becomes combinable with the others.</p>
              </div>
              <div>
                <SubmitButton label="Link tables" pendingLabel="Linking…" className={buttonStyles("primary", "md")} />
              </div>
            </ActionForm>
          </Card>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Add at least two tables before linking any together.</p>
        )}
      </section>
    </div>
  );
}


function formatDateRange(from: Date, to: Date): string {
  if (from.getTime() === to.getTime()) return formatDate(from);
  return `${formatDate(from)} - ${formatDate(to)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
