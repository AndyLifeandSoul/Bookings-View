import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addOverride, saveWeeklyHours } from "./actions";
import { OverrideFields } from "./override-form";
import { DeleteOverrideButton } from "./delete-override-button";
import { WeeklyHoursTable, type WeeklyDay } from "./weekly-hours-table";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type OverrideRow = {
  id: string;
  dateFrom: Date;
  dateTo: Date;
  canBook: boolean;
  mode: "OPEN" | "PRIVATE_HIRE_ONLY";
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

export default async function HoursPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [weeklyHours, overrides] = await Promise.all([
    prisma.openingHours.findMany({ where: { venueId: venue.id } }),
    prisma.openingHoursOverride.findMany({
      where: { venueId: venue.id },
      orderBy: [{ dateFrom: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const byDay = new Map(weeklyHours.map((row) => [row.dayOfWeek, row]));

  // Forces the weekly-hours ActionForm (and every TimeFieldSelect inside
  // it) to remount when the underlying data actually changes, rather than
  // React reconciling onto the same <select> DOM nodes and leaving their
  // defaultValue-set initial choice in place - the same "stale Router
  // Cache wins the race against revalidatePath()" class of bug documented
  // on action-form.tsx and already worked around elsewhere (e.g. the
  // booking details page's key={booking.updatedAt.getTime()}). OpeningHours
  // has no updatedAt of its own to key on, so this hashes the actual
  // per-day hours instead - changes exactly when a save actually changed
  // something, which is exactly when the form needs to re-initialise.
  const weeklyHoursKey = DAY_LABELS.map((_, day) => {
    const existing = byDay.get(day);
    return existing ? `${day}:${existing.mode}:${existing.opensAt}-${existing.closesAt}` : `${day}:closed`;
  }).join(",");

  // Monday first, the way venues plan their week.
  const weeklyDays: WeeklyDay[] = [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const label = DAY_LABELS[day];
    const existing = byDay.get(day);
    return {
      day,
      label,
      state: existing ? (existing.mode === "PRIVATE_HIRE_ONLY" ? "private_hire_only" : "open") : "closed",
      opensAt: existing?.opensAt ?? "18:00",
      closesAt: existing?.closesAt ?? "23:00",
    };
  });

  const today = new Date();
  const todayDateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // A range still relevant if it hasn't fully finished yet.
  const upcomingOverrides = overrides.filter((o) => o.dateTo >= todayDateOnly);
  const pastOverrides = overrides.filter((o) => o.dateTo < todayDateOnly);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Weekly opening hours</h2>
        <Card padded={false} className="mt-4 overflow-hidden">
          <ActionForm key={weeklyHoursKey} action={saveWeeklyHours}>
            <input type="hidden" name="venueId" value={venue.id} />
<WeeklyHoursTable days={weeklyDays} />
            <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
              <SubmitButton label="Save weekly hours" pendingLabel="Saving…" className={buttonStyles("primary", "md")} />
            </div>
          </ActionForm>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Special dates</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Closures, different hours on holidays, private hire days, or a few hours blocked for an event. These win over the weekly hours.
        </p>

        {upcomingOverrides.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5">Dates</th>
                    <th className="px-4 py-2.5">What happens</th>
                    <th className="px-4 py-2.5">Hours</th>
                    <th className="px-4 py-2.5">Note</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {upcomingOverrides.map((override) => (
                    <tr key={override.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">{formatDateRange(override.dateFrom, override.dateTo)}</td>
                      <td className="px-4 py-3">{overrideStatus(override)}</td>
                      <td className="px-4 py-3">{override.startTime && override.endTime ? `${override.startTime} to ${override.endTime}` : "-"}</td>
                      <td className="px-4 py-3 text-zinc-500">{override.note ?? "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteOverrideButton id={override.id} venueId={venue.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="mt-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">Add a special date</h3>
          <ActionForm action={addOverride} className="flex flex-col gap-5">
            <input type="hidden" name="venueId" value={venue.id} />
            <OverrideFields />
            <div>
              <SubmitButton label="Add special date" pendingLabel="Adding..." className={buttonStyles("primary", "md")} />
            </div>
          </ActionForm>
        </Card>

        {pastOverrides.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-700">
              {pastOverrides.length} past special date{pastOverrides.length === 1 ? "" : "s"}
            </summary>
            <Card padded={false} className="mt-2 overflow-hidden">
              <table className="w-full text-left text-sm">
                <tbody>
                  {pastOverrides.map((override) => (
                    <tr key={override.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-900">{formatDateRange(override.dateFrom, override.dateTo)}</td>
                      <td className="px-4 py-3 text-zinc-500">{overrideStatus(override)}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {override.startTime && override.endTime ? `${override.startTime} to ${override.endTime}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{override.note ?? "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteOverrideButton id={override.id} venueId={venue.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </details>
        )}
      </section>
    </div>
  );
}

function overrideStatus(override: OverrideRow) {
  if (override.canBook) {
    return override.mode === "PRIVATE_HIRE_ONLY" ? (
      <Badge variant="warning">Private hire only</Badge>
    ) : (
      <Badge variant="success">Different hours</Badge>
    );
  }
  if (override.startTime && override.endTime) return <Badge variant="danger">Blocked part of the day</Badge>;
  return <Badge variant="danger">Closed</Badge>;
}

function formatDateRange(from: Date, to: Date): string {
  if (from.getTime() === to.getTime()) return formatDate(from);
  return `${formatDate(from)} to ${formatDate(to)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
