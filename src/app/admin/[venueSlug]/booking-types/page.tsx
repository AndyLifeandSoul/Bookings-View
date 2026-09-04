import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteBookingTypeButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function BookingTypesPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const bookingTypes = await prisma.bookingType.findMany({
    where: { venueId: venue.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Booking types</h2>
          <p className="mt-1 text-sm text-zinc-500">
            What customers pick before choosing a date and time, dining, brunch, private hire, etc.
          </p>
        </div>
        <Link href={`/admin/${venue.slug}/booking-types/new`} className={buttonStyles("primary", "sm")}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New booking type
        </Link>
      </div>

      {bookingTypes.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Tag className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No booking types yet, customers can&apos;t book anything until one exists.</p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Party size</th>
                  <th className="px-4 py-2.5">Duration</th>
                  <th className="px-4 py-2.5">Deposit</th>
                  <th className="px-4 py-2.5">Enquiry above</th>
                  <th className="px-4 py-2.5">Pre-order</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {bookingTypes.map((bt) => (
                  <tr key={bt.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{bt.name}</div>
                      <div className="text-xs text-zinc-500">{bt.slug}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600">
                      {bt.minPartySize}–{bt.maxPartySize}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600">
                      {bt.minDurationMinutes}–{bt.maxDurationMinutes} min
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{depositLabel(bt.depositType, bt.depositAmount)}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600">
                      {bt.enquiryThresholdPartySize != null ? `${bt.enquiryThresholdPartySize} guests` : "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{bt.requiresPreOrder ? "Yes" : "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={bt.active ? "success" : "neutral"}>{bt.active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/${venue.slug}/booking-types/${bt.id}`}
                          className="text-sm font-medium text-zinc-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)]"
                        >
                          Edit
                        </Link>
                        <DeleteBookingTypeButton id={bt.id} name={bt.name} venueId={venue.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function depositLabel(depositType: string, depositAmount: number | null): string {
  if (depositType === "NONE" || depositAmount == null) return "None";
  const pounds = (depositAmount / 100).toFixed(2);
  return depositType === "PER_HEAD" ? `£${pounds}/head` : `£${pounds}`;
}
