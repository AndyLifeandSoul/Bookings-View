import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SortableList, type SortableItem } from "@/components/sortable-list";
import { DeleteBookingTypeButton } from "./delete-button";
import { reorderBookingTypes } from "./actions";

export const dynamic = "force-dynamic";

export default async function BookingTypesPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const bookingTypes = await prisma.bookingType.findMany({
    where: { venueId: venue.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const items: SortableItem[] = bookingTypes.map((bt) => ({
    id: bt.id,
    content: (
      <div className="flex items-center gap-3 px-3 py-3">
        <span
          className="h-8 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: bt.color ?? "var(--accent)" }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-zinc-900">{bt.name}</div>
          <div className="truncate text-xs text-zinc-500">{summary(bt)}</div>
        </div>
        <Badge variant={bt.active ? "success" : "neutral"}>{bt.active ? "Active" : "Inactive"}</Badge>
        <Link
          href={`/admin/${venue.slug}/booking-types/${bt.id}`}
          className="text-sm font-medium text-zinc-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)]"
        >
          Edit
        </Link>
        <DeleteBookingTypeButton id={bt.id} name={bt.name} venueId={venue.id} />
      </div>
    ),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Booking types</h2>
          <p className="mt-1 text-sm text-zinc-500">Drag to set the order customers see them in.</p>
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
          <SortableList items={items} reorder={reorderBookingTypes.bind(null, venue.id)} />
        </Card>
      )}
    </div>
  );
}

function summary(bt: {
  minPartySize: number;
  maxPartySize: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  depositType: string;
  depositAmount: number | null;
  requiresPreOrder: boolean;
}): string {
  const parts = [
    `${bt.minPartySize}-${bt.maxPartySize} guests`,
    `${bt.minDurationMinutes}-${bt.maxDurationMinutes} min`,
  ];
  if (bt.depositType !== "NONE" && bt.depositAmount != null) {
    const pounds = (bt.depositAmount / 100).toFixed(2);
    parts.push(bt.depositType === "PER_HEAD" ? `£${pounds}/head deposit` : `£${pounds} deposit`);
  }
  if (bt.requiresPreOrder) parts.push("pre-order");
  return parts.join(" · ");
}
