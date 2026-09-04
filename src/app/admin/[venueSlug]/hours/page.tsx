import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addOverride, saveWeeklyHours } from "./actions";
import { DeleteOverrideButton } from "./delete-override-button";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type OverrideRow = {
  id: string;
  dateFrom: Date;
  dateTo: Date;
  canBook: boolean;
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
          <ActionForm action={saveWeeklyHours}>
            <input type="hidden" name="venueId" value={venue.id} />
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5">Day</th>
                  <th className="px-4 py-2.5">Closed</th>
                  <th className="px-4 py-2.5">Opens</th>
                  <th className="px-4 py-2.5">Closes</th>
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((label, day) => {
                  const existing = byDay.get(day);
                  return (
                    <tr key={day} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">{label}</td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          name={`closed-${day}`}
                          defaultChecked={!existing}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="time"
                          name={`opensAt-${day}`}
                          defaultValue={existing?.opensAt ?? "18:00"}
                          className="rounded-md border border-zinc-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="time"
                          name={`closesAt-${day}`}
                          defaultValue={existing?.closesAt ?? "23:00"}
                          className="rounded-md border border-zinc-300 px-2 py-1"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
              <SubmitButton label="Save weekly hours" pendingLabel="Saving…" className={buttonStyles("primary", "md")} />
            </div>
          </ActionForm>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Special dates &amp; blocked periods</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Override the weekly hours for a date range: special/altered hours, a full closure, or a private-event block
          within an otherwise open day.
        </p>

        {upcomingOverrides.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5">Dates</th>
                    <th className="px-4 py-2.5">Can book</th>
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
                      <td className="px-4 py-3">{override.startTime && override.endTime ? `${override.startTime}–${override.endTime}` : "-"}</td>
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
          <ActionForm action={addOverride} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <input type="hidden" name="venueId" value={venue.id} />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Start date</span>
              <input type="date" name="dateFrom" required className="rounded-md border border-zinc-300 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">End date</span>
              <input type="date" name="dateTo" required className="rounded-md border border-zinc-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" name="canBook" className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm font-medium text-zinc-700">Can book</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Start time</span>
              <input type="time" name="startTime" className="rounded-md border border-zinc-300 px-2 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">End time</span>
              <input type="time" name="endTime" className="rounded-md border border-zinc-300 px-2 py-2" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Note (optional)</span>
              <input
                type="text"
                name="note"
                placeholder="e.g. Private hire"
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <SubmitButton label="Add override" pendingLabel="Adding…" className={buttonStyles("primary", "md")} />
          </ActionForm>
          <p className="mt-3 text-xs text-zinc-500">
            Tick &quot;Can book&quot; for special or altered hours (start/end time required), this replaces the normal
            weekly hours for these dates. Leave it unticked and both times blank to close the whole range. Leave it
            unticked and fill in times to block out just that window (e.g. a private event) while the rest of the day
            stays open as normal.
          </p>
        </Card>

        {pastOverrides.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-700">
              {pastOverrides.length} past override{pastOverrides.length === 1 ? "" : "s"}
            </summary>
            <Card padded={false} className="mt-2 overflow-hidden">
              <table className="w-full text-left text-sm">
                <tbody>
                  {pastOverrides.map((override) => (
                    <tr key={override.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-900">{formatDateRange(override.dateFrom, override.dateTo)}</td>
                      <td className="px-4 py-3 text-zinc-500">{overrideStatus(override)}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {override.startTime && override.endTime ? `${override.startTime}–${override.endTime}` : "-"}
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
  if (override.canBook) return <Badge variant="success">Open</Badge>;
  if (override.startTime && override.endTime) return <Badge variant="danger">Blocked</Badge>;
  return <Badge variant="danger">Closed</Badge>;
}

function formatDateRange(from: Date, to: Date): string {
  if (from.getTime() === to.getTime()) return formatDate(from);
  return `${formatDate(from)} – ${formatDate(to)}`;
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
