import { redirect } from "next/navigation";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { listActiveVenues } from "@/lib/venues/list-active-venues";

export const dynamic = "force-dynamic";

/**
 * Bare /staff has no venue in the URL yet. A STAFF session only ever has
 * one venue (session.venueSlug, set at login) — send it straight there. An
 * OWNER/MANAGER session is venue-independent, so it lands on the first
 * active venue, same default as bare /admin.
 */
export default async function StaffRootPage() {
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login");

  if (session.venueSlug) {
    redirect(`/staff/${session.venueSlug}`);
  }

  const venues = await listActiveVenues();
  if (venues.length === 0) {
    return <div className="px-4 py-8 text-zinc-600 sm:px-8">No venues exist yet.</div>;
  }
  redirect(`/staff/${venues[0].slug}`);
}
