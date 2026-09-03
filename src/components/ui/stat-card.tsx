/** One number tile for the admin dashboard's stat rows — a label and a big value, optionally a smaller sub-value underneath. */
export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-zinc-900">{value}</div>
      {sub && <div className="mt-1 text-sm text-zinc-500">{sub}</div>}
    </div>
  );
}
