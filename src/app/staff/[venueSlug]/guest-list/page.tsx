import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addGuestListEntry } from "./actions";
import { DoorButtons } from "./door-buttons";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Tonight in the venue's own time zone; until 6am it's still last night. */
function tonight(timezone: string): string {
  const d = new Date(Date.now() - 6 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function shift(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function label(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * The door list for a night: names (birthdays, promoters' guests, friends of
 * the house) with how many each, and a counter to tick people in as they
 * arrive. Bookings stay in the diary; this is for the queue.
 */
export default async function GuestListPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ date?: string; q?: string }>;
}) {
  const { venueSlug } = await params;
  const sp = await searchParams;
  const { venue } = await requireStaffVenue(venueSlug);
  const night = tonight(venue.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : night;
  const q = (sp.q ?? "").trim().toLowerCase();

  const entries = await prisma.guestListEntry.findMany({
    where: { venueId: venue.id, date: new Date(`${date}T00:00:00.000Z`) },
    orderBy: [{ name: "asc" }],
  });
  const active = entries.filter((e) => e.status !== "CANCELLED");
  const listed = active.reduce((s, e) => s + e.guests, 0);
  const arrived = active.reduce((s, e) => s + e.arrivedCount, 0);
  const shown = entries
    .filter((e) => !q || e.name.toLowerCase().includes(q) || (e.note ?? "").toLowerCase().includes(q))
    .sort((a, b) => {
      const rank = (s: string) => (s === "LISTED" ? 0 : s === "ARRIVED" ? 1 : 2);
      return rank(a.status) - rank(b.status) || a.name.localeCompare(b.name);
    });

  return (
    <div className="animate-in mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Guest list</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {label(date)}
            {date === night ? " (tonight)" : ""}: {arrived} of {listed} in, {active.length} {active.length === 1 ? "name" : "names"}.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/staff/${venue.slug}/guest-list?date=${shift(date, -1)}`} className={buttonStyles("secondary", "sm")} aria-label="Night before">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          {date !== night && (
            <Link href={`/staff/${venue.slug}/guest-list`} className={buttonStyles("secondary", "sm")}>
              Tonight
            </Link>
          )}
          <Link href={`/staff/${venue.slug}/guest-list?date=${shift(date, 1)}`} className={buttonStyles("secondary", "sm")} aria-label="Next night">
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <form method="get" className="mt-5 flex gap-2">
        <input type="hidden" name="date" value={date} />
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Find a name"
            autoComplete="off"
            className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-9 pr-3 text-base"
          />
        </label>
        <button type="submit" className={buttonStyles("secondary", "md")}>
          Find
        </button>
      </form>

      <Card padded={false} className="mt-4 divide-y divide-zinc-100">
        {shown.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-500">{q ? "No one by that name tonight." : "No names on the list yet."}</p>}
        {shown.map((e) => (
          <div key={e.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${e.status === "CANCELLED" || e.status === "NO_SHOW" ? "opacity-50" : ""}`}>
            <div className="min-w-0">
              <p className="text-base font-semibold text-zinc-900">
                {e.name}
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {e.guests === 1 ? "on their own" : `+${e.guests - 1}`}
                  {e.arriveBy ? `, by ${e.arriveBy}` : ""}
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                {[e.note, e.phone, e.addedBy ? `added by ${e.addedBy}` : null, e.status === "NO_SHOW" ? "no-show" : null, e.status === "CANCELLED" ? "removed" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <DoorButtons id={e.id} venueId={venue.id} arrived={e.arrivedCount} guests={e.guests} status={e.status} />
          </div>
        ))}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Add to the list for {label(date)}</h2>
        <ActionForm action={addGuestListEntry} className="flex flex-col gap-4">
          <input type="hidden" name="venueId" value={venue.id} />
          <input type="hidden" name="date" value={date} />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Name on the door</span>
              <input name="name" required placeholder="Jess Taylor" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">People</span>
              <input name="guests" type="number" min={1} max={200} defaultValue={2} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Arrive by</span>
              <select name="arriveBy" defaultValue="" className="rounded-md border border-zinc-300 px-2 py-2 text-sm">
                <option value="">Any time</option>
                {["21:00", "22:00", "22:30", "23:00", "23:30", "00:00", "00:30", "01:00"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Note</span>
              <input name="note" placeholder="Birthday, free entry before 11" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Phone</span>
              <input name="phone" type="tel" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <div>
            <SubmitButton label="Add to the list" pendingLabel="Adding..." className={buttonStyles("primary", "md")} />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
