import Link from "next/link";
import { CalendarOff, ChevronRight } from "lucide-react";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Admin's shortcut into a venue's diary, mirrors Settings' venue-picker
 * (same "pick a venue to jump into its venue-scoped pages" pattern), just
 * landing on /staff/[slug]/diary instead of /admin/[slug]/details. Only
 * active venues, unlike Settings: there's nothing to do in a paused venue's
 * diary. Once there, the staff layout's own VenueSwitcher covers jumping
 * between venues without a trip back through this picker.
 */
export default async function AdminDiaryPickerPage() {
  const venues = await listActiveVenues();

  return (
    // See admin/page.tsx's doc comment, every direct child of /admin
    // supplies its own padding, this one was missing it.
    <div className="animate-in mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Diary</h1>
      <p className="mt-1 text-sm text-zinc-500">Pick a venue to view its diary.</p>

      {venues.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <CalendarOff className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No active venues yet.</p>
        </Card>
      ) : (
        <div className="animate-in-stagger mt-6 grid gap-3 sm:grid-cols-2">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={`/staff/${venue.slug}/diary`}
              className="lift group flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 [box-shadow:var(--shadow-sm)] hover:border-[var(--accent)]"
            >
              <span className="font-medium text-zinc-900">{venue.name}</span>
              <ChevronRight
                className="h-4 w-4 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
                strokeWidth={2.25}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
