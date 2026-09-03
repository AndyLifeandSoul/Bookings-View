import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

/**
 * Top-level chrome for the whole /admin app — Home / Diary / Settings /
 * Customers / Sign out, per Andy's nav spec. Wraps every /admin/** route,
 * including the venue-scoped /admin/[venueSlug]/** pages (that inner
 * layout.tsx supplies its own secondary nav — Venue Details/Hours/Booking
 * Types/etc — for whichever venue Settings was used to reach).
 *
 * No venue switcher up here on purpose: Home, Diary, Settings and Customers
 * are all venue-independent (Home aggregates every venue, Customers lists
 * every venue's customers, Diary and Settings each just pick a venue to
 * jump into) — there's no "current venue" for a switcher to jump between
 * until you're inside a venue's diary or settings, which is where the venue
 * switcher still lives.
 *
 * Auth/role boundary: proxy.ts already blocks a STAFF-role session from
 * /admin entirely, but requireAdminSession() re-checks here too — a layout
 * reading identity straight off the cookie shouldn't assume the proxy ran.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();

  return (
    <>
      <TopBar
        navItems={[
          { href: "/admin", label: "Home", exact: true },
          { href: "/admin/diary", label: "Diary" },
          { href: "/admin/settings", label: "Settings", fallback: true },
          { href: "/admin/customers", label: "Customers" },
          // Standalone — not a per-venue concept, so it's not nested under
          // Settings' venue-scoped sub-nav. OWNER-only, same restriction as
          // the page/actions themselves (defence in depth either way).
          ...(session.role === "OWNER" ? [{ href: "/admin/staff", label: "Staff" }] : []),
        ]}
        userName={session.name}
        userRole={session.role}
      />
      <div className="flex-1 bg-zinc-50">{children}</div>
    </>
  );
}
