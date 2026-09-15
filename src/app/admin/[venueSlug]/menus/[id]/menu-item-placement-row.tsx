"use client";

import Link from "next/link";
import { useActionState } from "react";
import { detachItemFromMenu } from "../actions";
import type { ActionResult } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";

/**
 * A read-only row for one item already on this menu - item details
 * themselves are edited on the venue's Items section (Menus page), not
 * here. "Remove from menu" only detaches this one MenuItemPlacement, it
 * never touches the item itself or any other menu it's on.
 */
export function MenuItemPlacementRow({
  item,
  menuId,
  venueId,
  venueSlug,
  customisationStepCount,
}: {
  item: {
    id: string;
    name: string;
    description: string | null;
    priceInPence: number;
    dietaryTags: string[];
    active: boolean;
  };
  menuId: string;
  venueId: string;
  venueSlug: string;
  customisationStepCount: number;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => detachItemFromMenu(formData),
    undefined,
  );

  return (
    <>
      <tr className="border-b border-zinc-50 align-top transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
        <td className="px-4 py-3">
          <p className="font-medium text-zinc-900">{item.name}</p>
          {item.description && <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>}
        </td>
        <td className="px-4 py-3 tabular-nums text-zinc-600">£{(item.priceInPence / 100).toFixed(2)}</td>
        <td className="px-4 py-3 text-xs text-zinc-500">{item.dietaryTags.length > 0 ? item.dietaryTags.join(", ") : "-"}</td>
        <td className="px-4 py-3">
          <Badge variant={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            <Link
              href={`/admin/${venueSlug}/menus/${menuId}/items/${item.id}`}
              className="text-sm font-medium text-zinc-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)]"
            >
              Customise{customisationStepCount > 0 ? ` (${customisationStepCount} step${customisationStepCount === 1 ? "" : "s"})` : ""}
            </Link>
            <form action={deleteAction}>
              <input type="hidden" name="menuId" value={menuId} />
              <input type="hidden" name="menuItemId" value={item.id} />
              <input type="hidden" name="venueId" value={venueId} />
              <button
                type="submit"
                disabled={deletePending}
                className="text-sm font-medium text-[var(--danger)] underline decoration-dotted underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50"
              >
                {deletePending ? "Removing…" : "Remove from menu"}
              </button>
            </form>
          </div>
        </td>
      </tr>
      {deleteState?.error && (
        <tr>
          <td colSpan={5} className="px-4 pb-2 text-xs text-[var(--danger-soft-text)]">
            {deleteState.error}
          </td>
        </tr>
      )}
    </>
  );
}
