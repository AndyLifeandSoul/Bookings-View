import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { TableFields } from "../table-fields";
import { createTable } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTablePage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);
  const areas = await prisma.area.findMany({ where: { venueId: venue.id }, orderBy: { priority: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">New table</h2>
      <ActionForm action={createTable}>
        <input type="hidden" name="venueId" value={venue.id} />
        <TableFields areas={areas} submitLabel="Create table" />
      </ActionForm>
    </div>
  );
}
