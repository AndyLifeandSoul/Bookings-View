import Link from "next/link";
import { ActionForm, type ActionResult } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CustomerProfile, GuestVisit } from "@/lib/admin/customer-record";
import { guestStats } from "@/lib/admin/customer-record";
import { PRESET_TAGS } from "@/lib/admin/guest-tags";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function day(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const STATUS: Record<string, string> = {
  CONFIRMED: "Booked",
  COMPLETED: "Came",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
  ENQUIRY: "Enquiry",
  PENDING_PAYMENT: "Unpaid",
};

/**
 * Who this guest is across every booking: visits, no-shows, spend, tags,
 * allergies and private notes (editable), and their booking history.
 * Used on the staff booking page and the admin customer profile.
 */
export function GuestPanel({
  profile,
  visits,
  currentBookingId,
  action,
  hidden,
  visitHref,
  showHistory = 6,
}: {
  profile: CustomerProfile;
  visits: GuestVisit[];
  currentBookingId?: string;
  action: (formData: FormData) => Promise<ActionResult>;
  hidden: Record<string, string>;
  visitHref: (v: GuestVisit) => string;
  showHistory?: number;
}) {
  const stats = guestStats(visits);
  const others = visits.filter((v) => v.id !== currentBookingId);
  const otherTags = profile.tags.filter((t) => !PRESET_TAGS.includes(t));
  const facts = [
    stats.visits === 0 ? "First visit" : `${stats.visits} ${stats.visits === 1 ? "visit" : "visits"}`,
    ...(stats.noShows ? [`${stats.noShows} no-show${stats.noShows === 1 ? "" : "s"}`] : []),
    ...(stats.cancellations ? [`${stats.cancellations} cancelled`] : []),
    ...(stats.lastVisit ? [`last came ${day(stats.lastVisit)}`] : []),
    ...(stats.spentPence > 0 ? [`£${(stats.spentPence / 100).toFixed(2)} paid online`] : []),
  ];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {profile.tags.map((t) => (
          <span key={t} className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-soft-text)]">
            {t}
          </span>
        ))}
        <span className={`text-sm ${stats.noShows > 0 ? "text-amber-800" : "text-zinc-600"}`}>{facts.join(", ")}.</span>
      </div>
      {profile.allergies && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <span className="font-semibold">Allergies on file:</span> {profile.allergies}
        </p>
      )}

      <ActionForm action={action} resetOnSuccess={false} className="flex flex-col gap-3">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-zinc-800">Tags</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {PRESET_TAGS.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-zinc-700">
                <input type="checkbox" name="tags" value={t} defaultChecked={profile.tags.includes(t)} className="h-4 w-4 rounded border-zinc-300" />
                {t}
              </label>
            ))}
          </div>
          <input name="tagsOther" defaultValue={otherTags.join(", ")} placeholder="Other tags, separated by commas" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Allergies</span>
          <input name="allergies" defaultValue={profile.allergies} placeholder="Kept on file and shown on every booking they make" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">Private notes</span>
          <textarea
            name="staffNotes"
            rows={2}
            defaultValue={profile.staffNotes}
            placeholder="Regular, prefers the window table. Requested a high chair last time."
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-zinc-500">Never shown to the guest.</span>
        </label>
        <div>
          <SubmitButton label="Save guest details" pendingLabel="Saving..." className={buttonStyles("secondary", "sm")} />
        </div>
      </ActionForm>

      {others.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">{currentBookingId ? "Other bookings" : "Bookings"}</span>
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
            {others.slice(0, showHistory).map((v) => (
              <li key={v.id}>
                <Link href={visitHref(v)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-zinc-50">
                  <span className="text-zinc-800">
                    {day(v.date)} at {v.startTime}, {v.partySize} guests
                    <span className="text-zinc-500">, {v.typeName} at {v.venueName}</span>
                  </span>
                  <span className={`text-xs font-semibold ${v.status === "NO_SHOW" ? "text-red-700" : v.status === "CANCELLED" ? "text-zinc-500" : "text-zinc-700"}`}>
                    {STATUS[v.status] ?? v.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {others.length > showHistory && <span className="text-xs text-zinc-500">And {others.length - showHistory} more.</span>}
        </div>
      )}
    </Card>
  );
}
