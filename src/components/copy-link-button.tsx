"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

/**
 * There's no automated email for pre-order invites yet (Andy's decision -
 * manual for now), so this is how staff actually get the link to the
 * customer: copy it here, paste it wherever they're messaging them. Plain
 * navigator.clipboard.writeText with a brief "Copied" confirmation, reset
 * after a couple of seconds rather than staying stuck on "Copied" forever.
 */
export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked (permissions, non-secure context) -
      // the link is still visible in the input next to this button, so
      // staff can select-and-copy manually if this fails silently.
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={buttonStyles("secondary", "sm")}>
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
          Copy link
        </>
      )}
    </button>
  );
}
