"use client";

import { useRouter } from "next/navigation";

/**
 * Makes a whole table row a click target, not just the one cell that
 * happens to have a <Link> in it - any link inside still works normally
 * for keyboard focus and right-click/open-in-new-tab, this just means a
 * mouse user doesn't have to land precisely on a few words of text to open
 * a row. A larger click target is exactly the kind of change that helps
 * staff of every skill level, not just power users who've learned where
 * the clickable text is. Used anywhere a list of rows each lead somewhere
 * (enquiries, bookings), not enquiry-specific despite the earlier name.
 */
export function ClickableRow({ href, className = "", children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr onClick={() => router.push(href)} className={`cursor-pointer ${className}`}>
      {children}
    </tr>
  );
}
