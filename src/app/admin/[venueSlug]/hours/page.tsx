import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addException, addOpeningHoursBlock, saveWeeklyHours } from "./actions";
import { DeleteExceptionButton } from "./delete-exception-button";
import { DeleteBlockButton } from "./delete-block-button";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function HoursPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const [weeklyHours, exceptions, blocks] = await Promise.all([
    prisma.openingHours.findMany({ where: { venueId: venue.id } }),
    prisma.openingHoursException.findMany({
      where: { venueId: venue.id },
      orderBy: { date: "asc" },
    }),
    prisma.openingHoursBlock.findMany({
      where: { venueId: venue.id },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }],
    }),
  ]);

  const byDay = new Map(weeklyHours.map((row) => [row.dayOfWeek, row]));
  const today = new Date();
  const todayDateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const upcomingExceptions = exceptions.filter((e) => e.date >= todayDateOnly);
  const pastExceptions = exceptions.filter((e) => e.date < todayDateOnly);
  const upcomingBlocks = blocks.filter((b) => b.date >= todayDateOnly);
  const pastBlocks = blocks.filter((b) => b.date < todayDateOnly);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Weekly opening hours</h2>
        <p className="mt-1 text-sm text-zinc-500">
          A day left checked as closed ignores its times. Closing time earlier than opening time is treated as past
          midnight, e.g. 12:00–02:00 is a valid Friday.
        </p>
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
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Special dates</h2>
        <p className="mt-1 text-sm text-zinc-500">
          One-off overrides for a specific date, a closure, a bank holiday, extended NYE hours. Where a date has an
          entry here, it completely replaces the weekly hours above for that date.
        </p>

        {upcomingExceptions.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Hours</th>
                    <th className="px-4 py-2.5">Note</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {upcomingExceptions.map((exception) => (
                    <tr key={exception.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">{formatDate(exception.date)}</td>
                      <td className="px-4 py-3">
                        {exception.isClosed ? (
                          <Badge variant="danger">Closed</Badge>
                        ) : (
                          `${exception.opensAt}–${exception.closesAt}`
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{exception.note ?? "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteExceptionButton id={exception.id} venueId={venue.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="mt-4">
          <ActionForm action={addException} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <input type="hidden" name="venueId" value={venue.id} />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Date</span>
              <input type="date" name="date" required className="rounded-md border border-zinc-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" name="isClosed" className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm font-medium text-zinc-700">Closed all day</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Opens</span>
              <input type="time" name="opensAt" className="rounded-md border border-zinc-300 px-2 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Closes</span>
              <input type="time" name="closesAt" className="rounded-md border border-zinc-300 px-2 py-2" />
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
            <SubmitButton label="Add date" pendingLabel="Adding…" className={buttonStyles("primary", "md")} />
          </ActionForm>
        </Card>

        {pastExceptions.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-700">
              {pastExceptions.length} past special date{pastExceptions.length === 1 ? "" : "s"}
            </summary>
            <Card padded={false} className="mt-2 overflow-hidden">
              <table className="w-full text-left text-sm">
                <tbody>
                  {pastExceptions.map((exception) => (
                    <tr key={exception.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-900">{formatDate(exception.date)}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {exception.isClosed ? "Closed" : `${exception.opensAt}–${exception.closesAt}`}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{exception.note ?? "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteExceptionButton id={exception.id} venueId={venue.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </details>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Blocked periods</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Carve a private event or closure out of an otherwise-open day, leaving the hours either side still
          bookable, e.g. open 12:00–22:00 but blocked 14:00–18:00 for a private hire. Unlike a special date above,
          this doesn&apos;t replace the whole day&apos;s hours, and more than one can apply to the same date.
        </p>

        {upcomingBlocks.length > 0 && (
          <Card padded={false} className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Blocked</th>
                    <th className="px-4 py-2.5">Note</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {upcomingBlocks.map((block) => (
                    <tr key={block.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">{formatDate(block.date)}</td>
                      <td className="px-4 py-3">
                        {block.startsAt}–{block.endsAt}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{block.note ?? "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteBlockButton id={block.id} venueId={venue.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="mt-4">
          <ActionForm action={addOpeningHoursBlock} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <input type="hidden" name="venueId" value={venue.id} />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Date</span>
              <input type="date" name="date" required className="rounded-md border border-zinc-300 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Blocked from</span>
              <input type="time" name="startsAt" required className="rounded-md border border-zinc-300 px-2 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Blocked until</span>
              <input type="time" name="endsAt" required className="rounded-md border border-zinc-300 px-2 py-2" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Note (optional)</span>
              <input
                type="text"
                name="note"
                placeholder="e.g. Private event"
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <SubmitButton label="Add blocked period" pendingLabel="Adding…" className={buttonStyles("primary", "md")} />
          </ActionForm>
        </Card>

        {pastBlocks.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-700">
              {pastBlocks.length} past blocked period{pastBlocks.length === 1 ? "" : "s"}
            </summary>
            <Card padded={false} className="mt-2 overflow-hidden">
              <table className="w-full text-left text-sm">
                <tbody>
                  {pastBlocks.map((block) => (
                    <tr key={block.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-900">{formatDate(block.date)}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {block.startsAt}–{block.endsAt}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{block.note ?? "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteBlockButton id={block.id} venueId={venue.id} />
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

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
