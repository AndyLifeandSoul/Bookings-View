export function Card({
  children,
  className = "",
  padded = true,
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  /** Adds the shared hover-lift treatment, use for cards that are themselves a link/button or otherwise feel "clickable"; leave off for cards that just hold static content or a form. */
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200/80 bg-white [box-shadow:var(--shadow-sm)] ${interactive ? "lift" : ""} ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** Section wrapper used throughout admin/staff pages: a heading, optional description, optional right-aligned action, and a Card below it. */
export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
