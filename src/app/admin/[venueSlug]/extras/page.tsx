import { Gift } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createExtra, deleteExtra, updateExtra } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}

type Extra = { id: string; name: string; description: string | null; pricePence: number; perGuest: boolean; active: boolean; bookingTypes: { bookingTypeId: string }[] };

function ExtraFields({ extra, types }: { extra?: Extra; types: { id: string; name: string }[] }) {
  const ticked = new Set(extra?.bookingTypes.map((b) => b.bookingTypeId) ?? []);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Name</span>
          <input name="name" required maxLength={60} defaultValue={extra?.name ?? ""} placeholder="Prosecco on arrival" className={input} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Price</span>
          <span className="flex items-center gap-1.5">
            <span className="text-sm text-zinc-500">£</span>
            <input name="pricePounds" type="number" min={0} step="0.01" required defaultValue={extra ? (extra.pricePence / 100).toFixed(2) : ""} className={`${input} w-24`} aria-label="Price in pounds" />
            <select name="perGuest" defaultValue={extra?.perGuest ? "on" : "off"} className={input} aria-label="Per guest or per booking">
              <option value="on">per guest</option>
              <option value="off">per booking</option>
            </select>
          </span>
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Description</span>
        <input name="description" maxLength={160} defaultValue={extra?.description ?? ""} placeholder="A glass each as you sit down" className={input} />
      </label>
      {types.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-zinc-800">Offered with</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {types.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" name="bookingTypeId" value={t.id} defaultChecked={ticked.has(t.id)} className="h-4 w-4 rounded border-zinc-300" />
                {t.name}
              </label>
            ))}
          </div>
          <span className="text-xs text-zinc-500">Tick none to offer it with every booking type.</span>
        </fieldset>
      )}
      {extra && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="hidden" name="active" value="off" />
          <input type="checkbox" name="active" defaultChecked={extra.active} className="h-4 w-4 rounded border-zinc-300" />
          Offer it to guests
        </label>
      )}
    </div>
  );
}

/**
 * Extras guests can add when they book: drinks on arrival, a cake, a
 * decorated table. Always paid online when booking, with any deposit.
 */
export default async function ExtrasPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);
  const [extras, types, sold] = await Promise.all([
    prisma.addOn.findMany({ where: { venueId: venue.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { bookingTypes: { select: { bookingTypeId: true } } } }),
    prisma.bookingType.findMany({ where: { venueId: venue.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.bookingAddOn.groupBy({ by: ["addOnId"], where: { booking: { venueId: venue.id, status: { not: "CANCELLED" } } }, _sum: { quantity: true } }),
  ]);
  const soldBy = new Map(sold.map((s) => [s.addOnId, s._sum.quantity ?? 0]));
  const typeName = new Map(types.map((t) => [t.id, t.name]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Extras</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Things guests can add when they book. They pay for them online at the same time, along with any deposit, and they show on the booking and the run sheet.
        </p>
      </div>

      {extras.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Gift className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No extras yet. Popular ones: prosecco on arrival, a birthday cake, balloons, a reserved booth.</p>
        </Card>
      ) : (
        <Card padded={false} className="divide-y divide-zinc-100">
          {extras.map((x) => (
            <details key={x.id} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900">{x.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {x.bookingTypes.length === 0 ? "Every booking type" : x.bookingTypes.map((b) => typeName.get(b.bookingTypeId)).filter(Boolean).join(", ")}
                    {soldBy.get(x.id) ? `, ${soldBy.get(x.id)} booked so far` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-zinc-900">
                  {pounds(x.pricePence)}
                  <span className="font-normal text-zinc-500">{x.perGuest ? " pp" : ""}</span>
                </span>
                <Badge variant={x.active ? "success" : "neutral"}>{x.active ? "On" : "Off"}</Badge>
                <span className="text-sm text-zinc-500 group-open:hidden">Edit</span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-4">
                <ActionForm action={updateExtra} resetOnSuccess={false} className="flex flex-col gap-4">
                  <input type="hidden" name="venueId" value={venue.id} />
                  <input type="hidden" name="id" value={x.id} />
                  <ExtraFields extra={x} types={types} />
                  <div className="flex items-center justify-between gap-3">
                    <SubmitButton label="Save" className={buttonStyles("primary", "sm")} />
                  </div>
                </ActionForm>
                <div className="flex justify-end">
                  <ConfirmDeleteButton action={deleteExtra} fields={{ venueId: venue.id, id: x.id }} confirmText={`Delete "${x.name}"? Bookings that already have it keep it.`} />
                </div>
              </div>
            </details>
          ))}
        </Card>
      )}

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Add an extra</h3>
        <ActionForm action={createExtra} className="flex flex-col gap-4">
          <input type="hidden" name="venueId" value={venue.id} />
          <ExtraFields types={types} />
          <div>
            <SubmitButton label="Add extra" pendingLabel="Adding..." className={buttonStyles("primary", "sm")} />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
