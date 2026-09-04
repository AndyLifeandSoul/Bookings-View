/**
 * Centralises the status-pill look that used to be a copy-pasted
 * STATUS_STYLES map in every page that renders a booking status (list,
 * diary, booking details, enquiries, dashboard), one definition here means
 * a new status or a colour tweak only has to happen once.
 */
const VARIANT_STYLES: Record<string, string> = {
  neutral: "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200",
  success: "bg-[var(--success-soft)] text-[var(--success-soft-text)] ring-1 ring-inset ring-emerald-100",
  warning: "bg-[var(--warning-soft)] text-[var(--warning-soft-text)] ring-1 ring-inset ring-amber-100",
  info: "bg-[var(--info-soft)] text-[var(--info-soft-text)] ring-1 ring-inset ring-sky-100",
  danger: "bg-[var(--danger-soft)] text-[var(--danger-soft-text)] ring-1 ring-inset ring-red-100",
  accent: "bg-[var(--accent-soft)] text-[var(--accent-soft-text)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--accent)_18%,white)]",
};

const DOT_STYLES: Record<string, string> = {
  neutral: "bg-zinc-400",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  info: "bg-[var(--info)]",
  danger: "bg-[var(--danger)]",
  accent: "bg-[var(--accent)]",
};

const STATUS_VARIANTS: Record<string, keyof typeof VARIANT_STYLES> = {
  CONFIRMED: "success",
  PENDING_PAYMENT: "warning",
  ENQUIRY: "info",
  COMPLETED: "neutral",
  NO_SHOW: "danger",
  CANCELLED: "danger",
};

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className = "",
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANT_STYLES;
  /** A small coloured dot before the label, useful when the badge sits inline in dense text/table cells and needs to read at a glance without leaning on colour alone for the pill background. */
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${VARIANT_STYLES[variant]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[variant]}`} />}
      {children}
    </span>
  );
}

/** Booking-status-specific badge, picks the variant from BookingStatus automatically. */
export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "neutral"} dot className={className}>
      {status.replace("_", " ").toLowerCase()}
    </Badge>
  );
}
