/**
 * Centralises the status-pill look that used to be a copy-pasted
 * STATUS_STYLES map in every page that renders a booking status (list,
 * diary, booking details, enquiries, dashboard) — one definition here means
 * a new status or a colour tweak only has to happen once.
 */
const VARIANT_STYLES: Record<string, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
  danger: "bg-red-100 text-red-800",
  accent: "bg-[var(--accent-soft)] text-[var(--accent-soft-text)]",
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
  className = "",
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANT_STYLES;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VARIANT_STYLES[variant]} ${className}`}>
      {children}
    </span>
  );
}

/** Booking-status-specific badge — picks the variant from BookingStatus automatically. */
export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "neutral"} className={className}>
      {status.replace("_", " ").toLowerCase()}
    </Badge>
  );
}
