import type { BookingType } from "@/generated/prisma";
import { SubmitButton } from "@/components/submit-button";

/** Shared field markup for the create and edit forms — kept as one component so the two forms can't drift apart. */
export function BookingTypeFields({
  defaults,
  submitLabel,
}: {
  defaults?: BookingType;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-5">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Party size</legend>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-zinc-700">Min</span>
              <input
                type="number"
                name="minPartySize"
                min={1}
                required
                defaultValue={defaults?.minPartySize ?? 1}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-zinc-700">Max</span>
              <input
                type="number"
                name="maxPartySize"
                min={1}
                required
                defaultValue={defaults?.maxPartySize ?? 20}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Duration (minutes)</legend>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-zinc-700">Min</span>
              <input
                type="number"
                name="minDurationMinutes"
                min={15}
                step={5}
                required
                defaultValue={defaults?.minDurationMinutes ?? 90}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-zinc-700">Max</span>
              <input
                type="number"
                name="maxDurationMinutes"
                min={15}
                step={5}
                required
                defaultValue={defaults?.maxDurationMinutes ?? 120}
                className="rounded-md border border-zinc-300 px-3 py-2"
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
        <SubmitButton
          label={submitLabel}
          pendingLabel="Saving…"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
