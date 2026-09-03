"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

export interface TopBarNavItem {
  href: string;
  label: string;
  /** Only ever active on an exact pathname match (used for "Home" — otherwise every sub-route would also light it up as a startsWith("/admin") match). */
  exact?: boolean;
  /** The tab to fall back to when no item's href prefix-matches the current path at all — e.g. Settings for a venue-scoped /admin/[venueSlug]/... page, since those aren't literally under /admin/settings in the URL. At most one item per nav should set this. */
  fallback?: boolean;
}

/**
 * Shared chrome for both the /admin and /staff/[venueSlug] apps — one dark
 * bar with the Life & Soul mark, this app's top-level tabs (Home/Settings/
 * Customers for admin, Diary/Enquiries/Messages for staff, see each
 * layout.tsx for how the tab list is built), and the signed-in user plus
 * sign out on the right. Rendered once per layout, above whatever that
 * section's own page/sub-nav puts below it — this is what makes every page
 * in the app share one consistent "this is a real tool" frame instead of
 * each page inventing its own header.
 *
 * Client component so it can highlight the active tab off the real current
 * pathname via usePathname() — a Server Component has no clean way to read
 * that, and it can't take a JS function as a prop from one (see
 * ActionForm's doc comment) so the matching rules above are plain
 * booleans/strings instead.
 */
export function TopBar({
  navItems,
  userName,
  userRole,
  rightExtra,
}: {
  navItems: TopBarNavItem[];
  userName: string;
  userRole: string;
  rightExtra?: React.ReactNode;
}) {
  const pathname = usePathname();

  const exactHit = navItems.find((item) => item.exact && pathname === item.href);
  const prefixHit = !exactHit
    ? [...navItems]
        .filter((item) => !item.exact && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
        .sort((a, b) => b.href.length - a.href.length)[0]
    : undefined;
  const fallbackHit = !exactHit && !prefixHit ? navItems.find((item) => item.fallback) : undefined;
  const activeHref = (exactHit ?? prefixHit ?? fallbackHit)?.href;

  return (
    <div className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-8">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight text-white">
          Life &amp; Soul
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                item.href === activeHref
                  ? "bg-[var(--accent)] text-white"
                  : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {rightExtra}
          <div className="hidden text-right text-xs text-zinc-400 sm:block">
            <div className="font-medium text-zinc-200">{userName}</div>
            <div>{roleLabel(userRole)}</div>
          </div>
          <span className="[&_button]:text-zinc-300 [&_button:hover]:text-white">
            <LogoutButton />
          </span>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
