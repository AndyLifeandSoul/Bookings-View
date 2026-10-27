import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { naturalSortTables } from "@/lib/tables/natural-sort";
import { FloorPlanEditor } from "./floor-plan-editor";

export const dynamic = "force-dynamic";

/** Lay out the tables as they are in the room. Used by the live floor view staff see during service. */
export default async function FloorPlanPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);
  const [areas, tables] = await Promise.all([
    prisma.area.findMany({ where: { venueId: venue.id }, orderBy: { priority: "asc" }, select: { id: true, name: true } }),
    prisma.table.findMany({ where: { venueId: venue.id, active: true } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Floor plan</h2>
        <p className="mt-1 text-sm text-zinc-500">Drag tables to where they are in the room. Staff see this plan live during service, with who&apos;s sat where.</p>
      </div>
      <FloorPlanEditor
        venueId={venue.id}
        areas={areas}
        initial={naturalSortTables(tables).map((t) => ({
          id: t.id,
          label: t.label,
          maxCovers: t.maxCovers,
          areaId: t.areaId,
          x: t.planX,
          y: t.planY,
          w: t.planW,
          h: t.planH,
          shape: t.planShape,
          rotate: t.planRotate,
        }))}
      />
    </div>
  );
}
