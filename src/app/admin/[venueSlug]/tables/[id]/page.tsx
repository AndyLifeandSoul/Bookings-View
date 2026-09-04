import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { TableFields } from "../table-fields";
import { updateTable } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditTablePage({ params }: { params: Promise<{ venueSlug: string; id: string }> }) {
  const { venueSlug, id } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [table, areas] = await Promise.all([
    prisma.table.findFirst({ where: { id, venueId: venue.id } }),
    prisma.area.findMany({ where: { venueId: venue.id }, orderBy: { priority: "asc" } }),
  ]);
  if (!table) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Edit {table.label}</h2>
      <ActionForm action={updateTable}>
        <input type="hidden" name="venueId" value={venue.id} />
        <TableFields defaults={table} areas={areas} submitLabel="Save changes" />
      </ActionForm>
    </div>
  );
}
