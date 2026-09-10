"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Same header/description/action shape as the shared Section component
 * (@/components/ui/card), but the body starts collapsed and toggles on
 * click - kept local to this page rather than added to the shared Section
 * itself, so every other admin page that uses Section (venue details, the
 * dashboard) keeps its current always-open behaviour untouched.
 *
 * action (e.g. the "New menu" button) sits in the header row alongside the
 * title, outside the collapsible body, so it stays reachable even while
 * the section is collapsed.
 */
export function CollapsibleSection({
  title,
  description,
  action,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="group flex flex-1 items-start gap-2.5 text-left"
        >
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-150 group-hover:text-zinc-600 ${open ? "" : "-rotate-90"}`}
            strokeWidth={2.25}
          />
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
          </div>
        </button>
        {action}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
