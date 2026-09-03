import Link from "next/link";
import { listActiveVenues } from "@/lib/venues/list-active-venues";

export const dynamic = "force-dynamic";

/**
 * Admin's shortcut into a venue's diary — mirrors Settings' venue-picker
 * (same "pick a venue to jump into its venue-scoped pages" pattern), just
 * landing on /staff/[slug]/diary instead of /admin/[slug]/details. Only
 * active venues, unlike Settings: there's nothing to do in a paused venue's
 * diary. Once there, the staff layout's own VenueSwitcher covers jumping
 * between venues without a trip back through this picker.
 */
export default async function AdminDiaryPickerPage() {
  const venues = await listActiveVenues();

  return (
    // See admin/page.tsx's doc comment — every direct child of /admin
    // supplies its own padding, this one was missing it.
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Diary</h1>
      <p className="mt-1 text-sm text-zinc-500">Pick a venue to view its diary.</p>

      {venues.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No active venues yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={`/staff/${venue.slug}/diary`}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-[var(--accent)]"
            >
              <span className="font-medium text-zinc-900">{venue.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
