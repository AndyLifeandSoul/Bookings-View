import { redirect } from "next/navigation";
import { listActiveVenues } from "@/lib/venues/list-active-venues";

export const dynamic = "force-dynamic";

/** Bare /admin has no venue in the URL yet — land on the first active venue's hours page. */
export default async function AdminRootPage() {
  const venues = await listActiveVenues();
  if (venues.length === 0) {
    return <div className="px-4 py-8 text-zinc-600 sm:px-8">No venues exist yet — nothing to administer.</div>;
  }
  redirect(`/admin/${venues[0].slug}/hours`);
}
