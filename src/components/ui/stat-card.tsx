import type { LucideIcon } from "lucide-react";

const TONES = {
  accent: "bg-[var(--accent-soft)] text-[var(--accent-soft-text)]",
  /* "violet" kept as the tone name used across the admin dashboard's stat
   * rows, repointed to the warm terracotta secondary accent instead of a
   * leftover violet that no longer relates to anything else in the
   * palette now the primary accent's moved off indigo/violet. */
  violet: "bg-[color-mix(in_srgb,var(--accent-2)_14%,white)] text-[color-mix(in_srgb,var(--accent-2)_75%,black)]",
  success: "bg-[var(--success-soft)] text-[var(--success-soft-text)]",
  info: "bg-[var(--info-soft)] text-[var(--info-soft-text)]",
} as const;

/** One number tile for the admin dashboard's stat rows, a label and a big value, optionally a smaller sub-value underneath and an icon badge for quick visual scanning across a row of tiles. */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "accent",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="lift rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-sm)]">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{value}</div>
      {sub && <div className="mt-1 text-sm text-zinc-500">{sub}</div>}
    </div>
  );
}
