"use client";

import { createContext, startTransition, useActionState, useContext, useRef } from "react";
import { useRouter } from "next/navigation";

export type ActionResult = { error?: string } | void;

/** Pending state of the enclosing ActionForm, read by SubmitButton (see below for why useFormStatus alone isn't enough). */
const ActionFormPending = createContext(false);
export function useActionFormPending(): boolean {
  return useContext(ActionFormPending);
}

/**
 * Wraps a Server Action form so validation errors are actually visible.
 * Next.js redacts a thrown Error's message by default when it crosses from
 * a Server Action back to the client (all the browser gets is a generic
 * digest) - so every admin action returns `{ error: string }` on failure
 * instead of throwing, and this component is what surfaces that string.
 * Success paths call redirect()/revalidatePath() inside the action itself
 * and return nothing.
 *
 * children is plain ReactNode, not a render-prop function - a function
 * can't cross the server/client boundary as a prop (caught this in local
 * testing: "Functions cannot be passed directly to Client Components").
 * Anything inside the form that needs pending state (a submit button)
 * reads it itself via useFormStatus() or the ActionFormPending context -
 * see SubmitButton - rather than
 * having it threaded down as a prop.
 *
 * On a successful (non-redirecting, non-error) submit, we explicitly call
 * router.refresh() ourselves rather than trusting the action's own
 * revalidatePath() to keep the page in sync. Without this, forms on this
 * page (e.g. the booking status <select>) would visibly show the value the
 * user just saved for a few hundred ms, then snap back to the pre-edit
 * value - the client Router Cache entry for this route (populated when the
 * page first loaded) wins a race against the fresh data revalidatePath()
 * marked stale, even though the database write itself is already
 * committed (a plain reload always shows the correct saved value). Actions
 * that redirect() on success - the manual add-booking/add-enquiry flows -
 * throw internally before reaching the refresh() call, so this doesn't
 * interfere with those.
 *
 * Submits through onSubmit rather than letting React run the form action
 * itself, because React resets every field once a form action finishes,
 * error or not: a validation message would appear over a wiped form. Here
 * the fields are only reset after a successful save (resetOnSuccess, on by
 * default for "add" forms; pass false on edit forms so saved values don't
 * flash back to the old ones before the refresh lands).
 */

export function ActionForm({
  action,
  className,
  children,
  encType,
  resetOnSuccess = true,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  className?: string;
  children: React.ReactNode;
  encType?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const result = await action(formData);
      if (!result?.error) {
        if (resetOnSuccess) formRef.current?.reset();
        router.refresh();
      }
      return result;
    },
    undefined,
  );

  return (
    // encType is accepted for readability at call sites but not rendered:
    // React sends function actions as multipart already (files included)
    // and drops the attribute on the server, so rendering it only causes a
    // hydration mismatch.
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
      className={className}
      data-enctype={encType}
      aria-busy={pending}
    >
      {state?.error && (
        <p role="alert" className="animate-in mb-3 rounded-lg border border-red-100 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-soft-text)]">
          {state.error}
        </p>
      )}
      <ActionFormPending.Provider value={pending}>{children}</ActionFormPending.Provider>
    </form>
  );
}
