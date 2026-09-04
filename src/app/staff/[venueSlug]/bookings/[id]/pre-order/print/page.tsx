import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { groupPreOrderItems } from "@/lib/pre-order/group-items";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * A deliberately bare, high-contrast layout for kitchen use - large type,
 * no nav chrome (the shared [venueSlug]/layout.tsx TopBar is print:hidden,
 * see top-bar.tsx, so it never appears in the printed page even though
 * this route sits under it for auth). Opened in a new tab from the booking
 * details page's "Print for kitchen" link, not linked from anywhere else.
 */
export default async function PreOrderPrintPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const booking = await prisma.booking.findFirst({
    where: { id, venueId: venue.id },
    select: {
      customerName: true,
      bookingRef: true,
      date: true,
      startTime: true,
      partySize: true,
      preOrder: {
        select: {
          notes: true,
          items: {
            select: {
              quantity: true,
              guestLabel: true,
              notes: true,
              menuItem: {
                select: { name: true, priceInPence: true, dietaryTags: true, category: { select: { id: true, name: true, sortOrder: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!booking || !booking.preOrder) notFound();

  const groups = groupPreOrderItems(booking.preOrder.items);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 print:px-0 print:py-0">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <h1 className="text-2xl font-bold text-black">{booking.customerName}</h1>
      <p className="mt-1 text-base text-zinc-700">
        {booking.bookingRef ? `${booking.bookingRef} · ` : ""}
        {formatDate(booking.date)}, {booking.startTime} · party of {booking.partySize} · {venue.name}
      </p>

      {booking.preOrder.notes && (
        <div className="mt-4 border-4 border-black p-3">
          <p className="text-sm font-bold tracking-wide text-black uppercase">Customer allergies / requests</p>
          <p className="mt-1 text-lg font-semibold whitespace-pre-wrap text-black">{booking.preOrder.notes}</p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.category?.id ?? "uncategorised"}>
            {group.category && <h2 className="text-lg font-bold text-black uppercase">{group.category.name}</h2>}
            <ul className="mt-2 flex flex-col gap-2 border-t border-black/20">
              {group.items.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-4 border-b border-black/10 py-2 text-lg">
                  <span>
                    <span className="font-semibold text-black">
                      {item.quantity} x {item.menuItem.name}
                    </span>
                    {item.guestLabel && <span className="text-zinc-600"> ({item.guestLabel})</span>}
                    {item.menuItem.dietaryTags.length > 0 && (
                      <span className="block text-sm text-zinc-600">{item.menuItem.dietaryTags.join(", ")}</span>
                    )}
                    {item.notes && <span className="block text-sm text-zinc-600">Note: {item.notes}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
