/**
 * Default (empty) content for the @modal parallel-route slot - rendered
 * whenever the current URL doesn't match the intercepted booking route
 * below, e.g. on the diary itself, or on a hard load/refresh of any page
 * (a hard load always resolves the real page for that URL, never the
 * interception - see (.)bookings/[id]/page.tsx's own comment). Next.js
 * requires a default.tsx for a parallel slot that isn't always matched.
 */
export default function ModalDefault() {
  return null;
}
