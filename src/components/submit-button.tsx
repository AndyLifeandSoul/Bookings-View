"use client";

import { useFormStatus } from "react-dom";

/**
 * Reads pending state from the nearest enclosing <form> via useFormStatus
 * rather than having it passed as a prop, that's what lets this live as a
 * plain child inside a Server Component's form markup with no render-prop
 * plumbing needed to get pending state down to it.
 */
export function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && (
        <svg className="mr-1.5 -ml-0.5 inline h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z" />
        </svg>
      )}
      {pending ? (pendingLabel ?? "Saving…") : label}
    </button>
  );
}
