import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin/hours", label: "Opening Hours" },
  { href: "/admin/booking-types", label: "Booking Types" },
  { href: "/admin/menus", label: "Pre-order Menus" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Belt-and-braces: proxy.ts already blocks a STAFF-role session from
  // /admin entirely, but a page reading identity straight off the cookie
  // shouldn't just assume the proxy ran — same reasoning as /staff/page.tsx.
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login");
  if (session.role === "STAFF") redirect("/staff");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">{session.venueName} — Admin</h1>
            <p className="text-sm text-zinc-500">
              {session.name} · {roleLabel(session.role)}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/staff" className="text-sm text-zinc-500 underline hover:text-zinc-900">
              Staff diary
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="mx-auto mt-4 flex max-w-4xl gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
