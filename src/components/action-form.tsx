"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

export type ActionResult = { error?: string } | void;

/**
 * Wraps a Server Action form so validation errors are actually visible.
 * Next.js redacts a thrown Error's message by default when it crosses from
 * a Server Action back to the client (all the browser gets is a generic
 * digest) — so every admin action returns `{ error: string }` on failure
 * instead of throwing, and this component is what surfaces that string.
 * Success paths call redirect()/revalidatePath() inside the action itself
 * and return nothing.
 *
 * children is plain ReactNode, not a render-prop function — a function
 * can't cross the server/client boundary as a prop (caught this in local
 * testing: "Functions cannot be passed directly to Client Components").
 * Anything inside the form that needs pending state (a submit button)
 * reads it itself via useFormStatus() — see SubmitButton — rather than
 * having it threaded down as a prop.
 *
 * On a successful (non-redirecting, non-error) submit, we explicitly call
 * router.refresh() ourselves rather than trusting the action's own
 * revalidatePath() to keep the page in sync. Without this, forms on this
 * page (e.g. the booking status <select>) would visibly show the value the
 * user just saved for a few hundred ms, then snap back to the pre-edit
 * value — the client Router Cache entry for this route (populated when the
 * page first loaded) wins a race against the fresh data revalidatePath()
 * marked stale, even though the database write itself is already
 * committed (a plain reload always shows the correct saved value). Actions
 * that redirect() on success — the manual add-booking/add-enquiry flows —
 * throw internally before reaching the refresh() call, so this doesn't
 * interfere with those.
 */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const result = await action(formData);
      if (!result?.error) {
        router.refresh();
      }
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className={className}>
      {state?.error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {children}
    </form>
  );
}
