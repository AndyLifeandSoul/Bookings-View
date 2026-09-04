import type { BookingType } from "@/generated/prisma";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { DateOverrideField, type DateOverrideRow } from "./date-override-field";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type BookingTypeDefaults = BookingType & {
  dateOverrides?: { date: Date; startTime: string | null; endTime: string | null; allow: boolean }[];
  areaPriorities?: { areaId: string; priority: number }[];
};

/** Shared field markup for the create and edit forms, kept as one component so the two forms can't drift apart. */
export function BookingTypeFields({
  defaults,
  areas,
  submitLabel,
}: {
  defaults?: BookingTypeDefaults;
  /** Every active area for this venue, for the area-priority picker below, see Andy's spec on BookingTypeArea. */
  areas: { id: string; name: string }[];
  submitLabel: string;
}) {
  const selectedAreaPriority = new Map((defaults?.areaPriorities ?? []).map((p) => [p.areaId, p.priority]));
  const selectedDays = new Set(defaults?.availableDaysOfWeek ?? []);
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-sm)]">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={defaults?.name}
            placeholder="Standard Dining"
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Slug</span>
          <input
            type="text"
            name="slug"
            required
            defaultValue={defaults?.slug}
            placeholder="standard-dining"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Description (optional)</span>
        <textarea
          name="description"
          defaultValue={defaults?.description ?? ""}
          rows={2}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={defaults?.active ?? true} className="h-4 w-4 rounded border-zinc-300" />
        <span className="text-sm font-medium text-zinc-700">
          Active <span className="font-normal text-zinc-500">(visible for new bookings)</span>
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Diary colour</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            name="color"
            defaultValue={defaults?.color ?? "#7c3aed"}
            className="h-9 w-14 cursor-pointer rounded-md border border-zinc-300 p-1"
          />
          <span className="text-xs text-zinc-500">Shown as the banner on this type&apos;s blocks in the staff table diary.</span>
        </div>
      </label>

      {/*
        min-w-0 appears three times below (both fieldsets, and every Min/Max
        label inside them) because this overlap bug had two separate causes
        stacked on top of each other, and the first fix here only caught the
        outer one:
        1. fieldset has a hard-coded UA-stylesheet min-width of min-content
           that Tailwind's `minmax(0,1fr)` grid columns don't override on
           their own, min-w-0 on the fieldset itself fixes this layer.
        2. Deeper: each Min/Max <input> has no explicit width, so its default
           rendered width (~244px) becomes its <label>'s min-content size.
           The label is a flex-1 item in a `flex items-center` row, and flex
           items default to min-width:auto, i.e. they refuse to shrink below
           that content minimum, so two 244px-minimum labels in one row
           demand ~496px+gap no matter how narrow their shared row actually
           is, and the second one spills out past the fieldset's own (now
           correctly sized) right edge. min-w-0 on the label is what actually
           lets it shrink to fit; layer 1 alone left this overflow in place,
           which is why the "Party size and duration minutes overlap" bug
           was still visible after the previous fix.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="flex min-w-0 flex-col gap-2 rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Party size</legend>
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm text-zinc-700">Min</span>
              <input
                type="number"
                name="minPartySize"
                min={1}
                required
                defaultValue={defaults?.minPartySize ?? 1}
                className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm text-zinc-700">Max</span>
              <input
                type="number"
                name="maxPartySize"
                min={1}
                required
                defaultValue={defaults?.maxPartySize ?? 20}
                className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-2 rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Duration (minutes)</legend>
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm text-zinc-700">Min</span>
              <input
                type="number"
                name="minDurationMinutes"
                min={15}
                step={5}
                required
                defaultValue={defaults?.minDurationMinutes ?? 90}
                className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm text-zinc-700">Max</span>
              <input
                type="number"
                name="maxDurationMinutes"
                min={15}
                step={5}
                required
                defaultValue={defaults?.maxDurationMinutes ?? 120}
                className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Duration step (minutes)</span>
          <input
            type="number"
            name="durationStepMinutes"
            min={5}
            step={5}
            defaultValue={defaults?.durationStepMinutes ?? 30}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Start time step (minutes)</span>
          <input
            type="number"
            name="startTimeStepMinutes"
            min={5}
            step={5}
            defaultValue={defaults?.startTimeStepMinutes ?? 15}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="runsUntilClose"
          defaultChecked={defaults?.runsUntilClose ?? false}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <span className="text-sm font-medium text-zinc-700">
          Runs until close <span className="font-normal text-zinc-500">(e.g. Quiz Night, ignores the duration fields above; every booking runs to that day&apos;s closing time)</span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Booking window</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-700">Earliest booking time (optional)</span>
            <input
              type="time"
              name="earliestBookingTime"
              defaultValue={defaults?.earliestBookingTime ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-700">Latest booking time (optional)</span>
            <input
              type="time"
              name="latestBookingTime"
              defaultValue={defaults?.latestBookingTime ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
        <span className="text-xs text-zinc-500">
          Narrows the venue&apos;s own opening hours for this type only: a booking can&apos;t start earlier or later
          than these times (it can still run past &quot;latest&quot;, it just can&apos;t start after it). Leave both
          blank to use the full opening hours.
        </span>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Available days</legend>
        <div className="flex flex-wrap gap-3">
          {DAYS_OF_WEEK.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                name="availableDaysOfWeek"
                value={d.value}
                defaultChecked={selectedDays.has(d.value)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              {d.label}
            </label>
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          Leave every day unchecked to close this type every day of the week, for a specials-only type that&apos;s
          only ever bookable on dates added below (e.g. Quiz Night). A date override below can still force a
          specific date open or closed regardless of this.
        </span>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Date override (optional)</legend>
        <DateOverrideField
          defaultRows={(defaults?.dateOverrides ?? []).map(
            (o): DateOverrideRow => ({
              date: o.date.toISOString().slice(0, 10),
              startTime: o.startTime ?? "",
              endTime: o.endTime ?? "",
              allow: o.allow,
            }),
          )}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Area restriction &amp; priority</legend>
        {areas.length === 0 ? (
          <p className="text-sm text-zinc-500">No areas set up for this venue yet. See Tables &amp; Areas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {areas.map((area) => (
              <div key={area.id} className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2">
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`area_${area.id}_selected`}
                    defaultChecked={selectedAreaPriority.has(area.id)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  {area.name}
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                  Priority
                  <input
                    type="number"
                    name={`area_${area.id}_priority`}
                    defaultValue={selectedAreaPriority.get(area.id) ?? 0}
                    className="w-16 rounded-md border border-zinc-300 px-2 py-1"
                  />
                </label>
              </div>
            ))}
          </div>
        )}
        <span className="text-xs text-zinc-500">
          Tick an area to restrict this type to only its tables (e.g. a wreath-making event assigned to the Shop
          tables only), lower priority number fills first. Leave every area unticked to allow every table,
          venue-wide priority order unchanged.
        </span>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Table fill mode</span>
        <select
          name="tableFillMode"
          defaultValue={defaults?.tableFillMode ?? "PER_BOOKING"}
          className="w-64 rounded-md border border-zinc-300 px-3 py-2"
        >
          <option value="PER_BOOKING">Per booking: just enough tables to fit the party</option>
          <option value="WHOLE_AREA">Whole area: staff pick one area, every table in it is reserved</option>
          <option value="WHOLE_VENUE">Whole venue: every table is reserved</option>
        </select>
        <span className="text-xs text-zinc-500">
          For Area Hire / Full Venue Hire-style types where a booking blocks a whole area or the whole venue
          regardless of party size, not just enough tables to fit. Adds a one-click &quot;fill this area&quot;/&quot;select
          every table&quot; helper to the Tables section on this type&apos;s bookings, instead of ticking tables one by
          one. Leave as &quot;Per booking&quot; for everything else.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Enquiry above this many guests (optional)</span>
        <input
          type="number"
          name="enquiryThresholdPartySize"
          min={1}
          defaultValue={defaults?.enquiryThresholdPartySize ?? ""}
          placeholder="e.g. 12"
          className="w-32 rounded-md border border-zinc-300 px-3 py-2"
        />
        <span className="text-xs text-zinc-500">
          A party at or under this size books instantly. Above it, the booking is created as an enquiry for staff to
          confirm manually instead of auto-confirming. Leave blank to always auto-confirm.
        </span>
      </label>

      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Deposit</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-700">Type</span>
            <select
              name="depositType"
              defaultValue={defaults?.depositType ?? "NONE"}
              className="rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="NONE">None</option>
              <option value="FIXED">Fixed amount</option>
              <option value="PER_HEAD">Per head</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-700">Amount (£, if a deposit type is set)</span>
            <input
              type="number"
              name="depositAmountPounds"
              min={0}
              step={0.01}
              defaultValue={defaults?.depositAmount != null ? (defaults.depositAmount / 100).toFixed(2) : ""}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
      </fieldset>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="requiresPreOrder"
          defaultChecked={defaults?.requiresPreOrder ?? false}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <span className="text-sm font-medium text-zinc-700">Requires a pre-order menu selection</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Sort order</span>
        <input
          type="number"
          name="sortOrder"
          defaultValue={defaults?.sortOrder ?? 0}
          className="w-32 rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <div>
        <SubmitButton label={submitLabel} pendingLabel="Saving…" className={buttonStyles("primary", "md")} />
      </div>
    </div>
  );
}
