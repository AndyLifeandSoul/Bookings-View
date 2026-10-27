import { TicketPercent } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DateSelect } from "@/components/date-select";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createOfferCode, deleteOfferCode, updateOfferCode } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function day(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function iso(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

type Code = {
  id: string;
  code: string;
  description: string | null;
  percentOff: number | null;
  amountOffPence: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
};

function offerText(c: Code): string {
  return c.percentOff ? `${c.percentOff}% off` : `£${((c.amountOffPence ?? 0) / 100).toFixed(2).replace(/\.00$/, "")} off`;
}

function CodeFields({ code }: { code?: Code }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Code</span>
          <input name="code" required defaultValue={code?.code ?? ""} placeholder="XMAS10" className={`${input} font-mono uppercase`} />
          <span className="text-xs text-zinc-500">What guests type in. Letters and numbers only.</span>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Takes off</span>
          <span className="flex items-center gap-1.5">
            <input name="value" type="number" min={0} step="any" required defaultValue={code ? (code.percentOff ?? (code.amountOffPence ?? 0) / 100) : ""} className={`${input} w-24`} aria-label="Amount off" />
            <select name="kind" defaultValue={code?.amountOffPence ? "amount" : "percent"} className={input} aria-label="Percent or pounds">
              <option value="percent">% of what&apos;s paid online</option>
              <option value="amount">pounds off</option>
            </select>
          </span>
          <span className="text-xs text-zinc-500">Comes off the deposit, prepaid menu and extras paid when booking.</span>
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Note for staff</span>
        <input name="description" maxLength={120} defaultValue={code?.description ?? ""} placeholder="Instagram Christmas campaign" className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">First booking date</span>
          <DateSelect name="validFrom" label="First booking date" defaultValue={iso(code?.validFrom ?? null)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Last booking date</span>
          <DateSelect name="validTo" label="Last booking date" defaultValue={iso(code?.validTo ?? null)} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Use limit</span>
          <input name="maxUses" type="number" min={1} defaultValue={code?.maxUses ?? ""} placeholder="No limit" className={`${input} w-28`} />
        </label>
      </div>
      <span className="-mt-2 text-xs text-zinc-500">The dates are the days the booking is for, not when it&apos;s made. Leave blank for any day.</span>
      {code && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="hidden" name="active" value="off" />
          <input type="checkbox" name="active" defaultChecked={code.active} className="h-4 w-4 rounded border-zinc-300" />
          Guests can use it
        </label>
      )}
    </div>
  );
}

/** Offer codes guests enter on the booking page for money off what they pay online. */
export default async function OfferCodesPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);
  const codes = await prisma.promoCode.findMany({ where: { venueId: venue.id }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
  const savings = await prisma.booking.groupBy({ by: ["promoCodeId"], where: { venueId: venue.id, promoCodeId: { not: null }, status: { not: "CANCELLED" } }, _sum: { discountPence: true } });
  const savedBy = new Map(savings.map((s) => [s.promoCodeId, s._sum.discountPence ?? 0]));
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Offer codes</h2>
        <p className="mt-1 text-sm text-zinc-500">Guests enter these on the booking page for money off what they pay online. Share them in posts, emails or with partners.</p>
      </div>

      {codes.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <TicketPercent className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No offer codes yet.</p>
        </Card>
      ) : (
        <Card padded={false} className="divide-y divide-zinc-100">
          {codes.map((c) => {
            const expired = c.validTo && iso(c.validTo) < todayIso;
            const usedUp = c.maxUses != null && c.uses >= c.maxUses;
            const state = !c.active ? "Off" : expired ? "Ended" : usedUp ? "Used up" : "Live";
            return (
              <details key={c.id} className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-sm font-semibold text-zinc-900">{c.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {offerText(c)}
                      {c.description ? <span className="font-normal text-zinc-500">, {c.description}</span> : null}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {c.validFrom || c.validTo ? `${c.validFrom ? `From ${day(c.validFrom)}` : "Any day"}${c.validTo ? ` to ${day(c.validTo)}` : " onwards"}. ` : ""}
                      Used {c.uses}
                      {c.maxUses != null ? ` of ${c.maxUses}` : ""} times
                      {savedBy.get(c.id) ? `, £${((savedBy.get(c.id) ?? 0) / 100).toFixed(2)} given` : ""}
                    </p>
                  </div>
                  <Badge variant={state === "Live" ? "success" : "neutral"}>{state}</Badge>
                  <span className="text-sm text-zinc-500 group-open:hidden">Edit</span>
                </summary>
                <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-4">
                  <ActionForm action={updateOfferCode} resetOnSuccess={false} className="flex flex-col gap-4">
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="id" value={c.id} />
                    <CodeFields code={c} />
                    <div>
                      <SubmitButton label="Save" className={buttonStyles("primary", "sm")} />
                    </div>
                  </ActionForm>
                  <div className="flex justify-end">
                    <ConfirmDeleteButton action={deleteOfferCode} fields={{ venueId: venue.id, id: c.id }} confirmText={`Delete ${c.code}?`} />
                  </div>
                </div>
              </details>
            );
          })}
        </Card>
      )}

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">New offer code</h3>
        <ActionForm action={createOfferCode} className="flex flex-col gap-4">
          <input type="hidden" name="venueId" value={venue.id} />
          <CodeFields />
          <div>
            <SubmitButton label="Create code" pendingLabel="Creating..." className={buttonStyles("primary", "sm")} />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
