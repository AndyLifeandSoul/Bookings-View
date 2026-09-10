import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { NewMenuForm } from "./new-menu-form";

export const dynamic = "force-dynamic";

export default async function NewMenuPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);
  const [bookingTypes, categories] = await Promise.all([
    prisma.bookingType.findMany({
      where: { venueId: venue.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.menuCategory.findMany({
      where: { venueId: venue.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href={`/admin/${venue.slug}/menus`}
          className="text-sm font-medium text-zinc-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)]"
        >
          &larr; Back to menus
        </Link>
        <h2 className="mt-2 text-base font-semibold text-zinc-900">New menu</h2>
      </div>
      <NewMenuForm venueId={venue.id} bookingTypes={bookingTypes} categories={categories} />
    </div>
  );
}
