"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Secondary (in-page) tab row — used for the venue settings sub-nav under Settings. Highlights whichever item's href is the longest prefix match of the current path. */
export function PillNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const active = [...items]
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            item.href === active
              ? "bg-[var(--accent-soft)] text-[var(--accent-soft-text)]"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
