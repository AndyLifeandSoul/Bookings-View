import Link from "next/link";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { buttonStyles } from "@/components/ui/button";
import { prisma } from "@/lib/db/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { venueReadiness } from "@/lib/admin/readiness";

export const dynamic = "force-dynamic";

/** Venue picker, Settings' whole job is choosing which venue's admin pages to open (Andy's spec: "clicking on that venue opens the admin page for that venue"). Includes inactive venues too (greyed out), unlike listActiveVenues(), since an OWNER managing the estate still needs to reach a paused venue's settings. */
export default async function SettingsVenuePickerPage() {
  const session = await requireAdminSession();
  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, active: true, address: true, logoImageType: true, logoUrl: true, updatedAt: true },
  });
  const readiness = new Map(
    await Promise.all(
      venues.map(async (v) => {
        const r = await venueReadiness(v.id);
        const req = r.items.filter((i) => i.required);
        return [v.id, { live: r.live, left: req.filter((i) => !i.done).length }] as const;
      }),
    ),
  );

  return (
    // See admin/page.tsx's doc comment, every direct child of /admin
    // supplies its own padding, this one was missing it.
    <div className="animate-in mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Settings</h1>
        {session.role === "OWNER" && (
          <Link href="/admin/settings/new-venue" className={buttonStyles("primary", "sm")}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Add venue
          </Link>
        )}
      </div>

      {venues.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Building2 className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No venues exist yet.</p>
        </Card>
      ) : (
        <div className="animate-in-stagger mt-6 grid gap-3 sm:grid-cols-2">
          {venues.map((venue) => (
            <Link key={venue.id} href={`/admin/${venue.slug}/go-live`}>
              <Card interactive className={`flex items-center gap-3 ${!venue.active ? "opacity-60" : ""}`}>
                {venue.logoImageType || venue.logoUrl ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={venue.logoImageType ? `/api/venue-logo/${venue.slug}?v=${venue.updatedAt.getTime()}` : venue.logoUrl!}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </span>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-soft-text)]">
                    <Building2 className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">{venue.name}</span>
                    {!venue.active ? (
                      <Badge variant="neutral">Inactive</Badge>
                    ) : readiness.get(venue.id)?.left ? (
                      <Badge variant="warning">{readiness.get(venue.id)?.left} to set up</Badge>
                    ) : readiness.get(venue.id)?.live ? (
                      <Badge variant="success">Live</Badge>
                    ) : (
                      <Badge variant="neutral">Paused</Badge>
                    )}
                  </div>
                  {venue.address && <p className="mt-0.5 truncate text-sm text-zinc-500">{venue.address}</p>}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" strokeWidth={2.25} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
