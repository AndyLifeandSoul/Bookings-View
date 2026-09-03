import { redirect } from "next/navigation";
import { getCurrentStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * "/" is the role-aware landing resolver — both /login's post-signin
 * default and proxy.ts's already-logged-in redirect send here rather than
 * straight to /staff, so where someone lands depends on their role: OWNER/
 * MANAGER get the admin Home dashboard, STAFF go straight to their venue's
 * diary (not the list — table view is the default per Andy's spec).
 */
export default async function RootPage() {
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login");

  if (session.role === "STAFF") {
    redirect(session.venueSlug ? `/staff/${session.venueSlug}/diary` : "/staff");
  }

  redirect("/admin");
}
