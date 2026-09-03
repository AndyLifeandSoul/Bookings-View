import { redirect } from "next/navigation";
import { getCurrentStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Auth/role boundary only — no venue chrome here, because admin sessions
 * are venue-independent and "which venue" only exists once we're under
 * /admin/[venueSlug] (see that segment's layout.tsx). Belt-and-braces: the
 * proxy already blocks a STAFF-role session from /admin entirely, but a
 * layout reading identity straight off the cookie shouldn't assume that ran.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login");
  if (session.role === "STAFF") redirect("/staff");

  return <div className="flex flex-1 flex-col bg-zinc-50">{children}</div>;
}
