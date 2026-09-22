import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AreaRow } from "./area-row";
import { DeleteAreaClosureButton } from "./delete-area-closure-button";
import { createArea, createTableCombination, deleteTableCombination, addAreaClosure, reorderAreas } from "./actions";
import { SortableList } from "@/components/sortable-list";
import { naturalSortTables } from "@/lib/tables/natural-sort";
import { TablesGrid, type GridTable } from "./tables-grid";
import { DateFieldSelect } from "@/components/date-field-select";

export const dynamic = "force-dynamic";

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

  const [areas, tablesRaw, combinationRows, closures] = await Promise.all([
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
    prisma.tableCombination.findMany({
      where: { venueId: venue.id },
      select: {
        id: true,
        entries: { select: { table: { select: { id: true, label: true, maxCovers: true } } } },
      },
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
  const combinations = combinationRows
    .map((c) => {
      const tables = c.entries
        .map((e) => e.table)
        .slice()
        .sort((x, y) => (orderIndex.get(x.id) ?? 0) - (orderIndex.get(y.id) ?? 0));
      return { id: c.id, tables, covers: tables.reduce((sum, t) => sum + t.maxCovers, 0) };
    })
    .sort((x, y) => (orderIndex.get(x.tables[0]?.id ?? "") ?? 0) - (orderIndex.get(y.tables[0]?.id ?? "") ?? 0));
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
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Table combinations</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Sets of tables you push together for one booking. Define each combination you actually use, for example T1 + T2 for a six, and separately T1 + T2 + T3 for a ten. They can overlap, and a party is only ever seated on a combination you have defined here.
        </p>

        {combinations.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
            <table className="w-full text-left text-sm">
              <tbody>
                {combinations.map((combo) => (
                  <tr key={combo.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {combo.tables.map((t) => t.label).join(" + ")}
                      <span className="ml-2 font-normal text-zinc-500">seats up to {combo.covers}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionForm action={deleteTableCombination} className="inline-flex">
                        <input type="hidden" name="venueId" value={venue.id} />
                        <input type="hidden" name="id" value={combo.id} />
                        <SubmitButton
                          label="Remove"
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
            <ActionForm action={createTableCombination} className="flex flex-col gap-3">
              <input type="hidden" name="venueId" value={venue.id} />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">Tables in this combination</span>
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
                <p className="text-xs text-zinc-500">Pick two or more tables. Create a separate combination for each grouping you use.</p>
              </div>
              <div>
                <SubmitButton label="Create combination" pendingLabel="Creating…" className={buttonStyles("primary", "md")} />
              </div>
            </ActionForm>
          </Card>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Add at least two tables before creating a combination.</p>
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
