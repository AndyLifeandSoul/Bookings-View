import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Table view (diary) is the default per Andy's spec — the list view moved to ./list, reachable only as a secondary link from there. */
export default async function StaffVenueRootPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  redirect(`/staff/${venueSlug}/diary`);
}
