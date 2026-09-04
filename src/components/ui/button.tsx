/**
 * Shared button/link look, used to be a different hand-copied className
 * string on every "Save", "Cancel", "Delete", "Add" control across admin
 * and staff pages (each with its own hover colour, its own idea of
 * padding), which is exactly the kind of drift that makes an app feel like
 * a pile of forms instead of one product. buttonStyles() returns a class
 * string so it works equally on a <button>, a <Link>, or SubmitButton
 * (which needs to own its own disabled/pending state and so can't be
 * wrapped by a component that renders its own <button>).
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-hover)] hover:shadow-md disabled:hover:bg-[var(--accent)] disabled:hover:shadow-sm",
  secondary:
    "border border-zinc-300 bg-white text-zinc-700 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 hover:shadow-md disabled:hover:bg-white disabled:hover:shadow-sm",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger:
    "border border-red-200 bg-white text-red-600 shadow-sm hover:border-red-300 hover:bg-red-50 hover:shadow-md disabled:hover:bg-white disabled:hover:shadow-sm",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function buttonStyles(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
}

/** Plain non-form button/action trigger (e.g. a link styled as a button). For a <form> submit control that needs pending state, use SubmitButton with buttonStyles() passed as its className. */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonStyles(variant, size, className)} {...props} />;
}
