"use client";

import { Printer } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

/** Triggers the browser's own print dialog - simplest possible "print this" control, no PDF generation of our own to maintain. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonStyles("primary", "sm", "mb-4")}>
      <Printer className="h-3.5 w-3.5" strokeWidth={2.25} />
      Print
    </button>
  );
}
