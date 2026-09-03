import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Booking types</h2>
          <p className="mt-1 text-sm text-zinc-500">
            What customers pick before choosing a date and time — dining, brunch, private hire, etc.
          </p>
        </div>
        <Link
          href={`/admin/${venue.slug}/booking-types/new`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New booking type
        </Link>
      </div>

      {bookingTypes.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No booking types yet — customers can&apos;t book anything until one exists.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Party size</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Deposit</th>
                <th className="px-4 py-2">Enquiry above</th>
                <th className="px-4 py-2">Pre-order</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {bookingTypes.map((bt) => (
                <tr key={bt.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-zinc-900">{bt.name}</div>
                    <div className="text-xs text-zinc-500">{bt.slug}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {bt.minPartySize}–{bt.maxPartySize}
                  </td>
                  <td className="px-4 py-2.5">
                    {bt.minDurationMinutes}–{bt.maxDurationMinutes} min
                  </td>
                  <td className="px-4 py-2.5">{depositLabel(bt.depositType, bt.depositAmount)}</td>
                  <td className="px-4 py-2.5">
                    {bt.enquiryThresholdPartySize != null ? `${bt.enquiryThresholdPartySize} guests` : "—"}
                  </td>
                  <td className="px-4 py-2.5">{bt.requiresPreOrder ? "Yes" : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        bt.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {bt.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/${venue.slug}/booking-types/${bt.id}`}
                        className="text-sm text-zinc-600 underline hover:text-zinc-900"
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
      )}
    </div>
  );
}

function depositLabel(depositType: string, depositAmount: number | null): string {
  if (depositType === "NONE" || depositAmount == null) return "None";
  const pounds = (depositAmount / 100).toFixed(2);
  return depositType === "PER_HEAD" ? `£${pounds}/head` : `£${pounds}`;
}
