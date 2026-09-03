"use client";

import { useFormStatus } from "react-dom";

/**
 * Reads pending state from the nearest enclosing <form> via useFormStatus
 * rather than having it passed as a prop — that's what lets this live as a
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
      {pending ? (pendingLabel ?? "Saving…") : label}
    </button>
  );
}
