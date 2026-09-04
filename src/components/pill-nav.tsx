"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, Clock, Tag, LayoutGrid, UtensilsCrossed, Megaphone, type LucideIcon } from "lucide-react";

/** Icon lookup by name, not a component reference, see TopBar's ICONS doc comment for why (Server Component -> Client Component prop serialisation). */
const ICONS = {
  store: Store,
  clock: Clock,
  tag: Tag,
  grid: LayoutGrid,
  menu: UtensilsCrossed,
  megaphone: Megaphone,
} satisfies Record<string, LucideIcon>;

export type PillNavIconName = keyof typeof ICONS;

export interface PillNavItem {
  href: string;
  label: string;
  icon?: PillNavIconName;
}

/** Secondary (in-page) tab row, used for the venue settings sub-nav under Settings. Highlights whichever item's href is the longest prefix match of the current path. */
export function PillNav({ items }: { items: PillNavItem[] }) {
  const pathname = usePathname();
  const active = [...items]
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const Icon = item.icon ? ICONS[item.icon] : undefined;
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
              isActive
                ? "bg-[var(--accent-soft)] text-[var(--accent-soft-text)] shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
