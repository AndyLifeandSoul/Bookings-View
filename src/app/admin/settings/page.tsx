import Link from "next/link";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** Venue picker — Settings' whole job is choosing which venue's admin pages to open (Andy's spec: "clicking on that venue opens the admin page for that venue"). Includes inactive venues too (greyed out), unlike listActiveVenues(), since an OWNER managing the estate still needs to reach a paused venue's settings. */
export default async function SettingsVenuePickerPage() {
  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, active: true, address: true },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">Pick a venue to manage its hours, booking types, tables, menus, marketing, and staff.</p>

      {venues.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No venues exist yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={`/admin/${venue.slug}/details`}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-[var(--accent)] ${
                venue.active ? "border-zinc-200" : "border-zinc-200 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-900">{venue.name}</span>
                {!venue.active && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Inactive</span>
                )}
              </div>
              {venue.address && <p className="mt-1 text-sm text-zinc-500">{venue.address}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
