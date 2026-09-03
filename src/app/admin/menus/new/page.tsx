import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { createMenu } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewMenuPage() {
  const session = await requireAdminSession();
  const bookingTypes = await prisma.bookingType.findMany({
    where: { venueId: session.venueId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-zinc-900">New menu</h2>
      <ActionForm action={createMenu} className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            type="text"
            name="name"
            required
            placeholder="Bottomless Brunch Menu"
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Description (optional)</span>
          <textarea name="description" rows={2} className="rounded-md border border-zinc-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Linked booking type</span>
          <select name="bookingTypeId" className="rounded-md border border-zinc-300 px-3 py-2">
            <option value="">Any</option>
            {bookingTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {bt.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-zinc-300" />
          <span className="text-sm font-medium text-zinc-700">Active</span>
        </label>
        <div>
          <SubmitButton
            label="Create menu"
            pendingLabel="Creating…"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          />
        </div>
      </ActionForm>
    </div>
  );
}
