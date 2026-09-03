import type { Table, Area } from "@/generated/prisma";
import { SubmitButton } from "@/components/submit-button";

/** Shared field markup for the create and edit table forms — kept as one component so the two forms can't drift apart. */
export function TableFields({
  defaults,
  areas,
  submitLabel,
}: {
  defaults?: Table;
  areas: Area[];
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-5">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Label</span>
          <input
            type="text"
            name="label"
            required
            defaultValue={defaults?.label}
            placeholder="T1, Booth 3, ..."
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Area (optional)</span>
          <select
            name="areaId"
            defaultValue={defaults?.areaId ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Unassigned</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-zinc-500">Covers</legend>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-zinc-700">Min</span>
            <input
              type="number"
              name="minCovers"
              min={1}
              required
              defaultValue={defaults?.minCovers ?? 1}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-zinc-700">Max</span>
            <input
              type="number"
              name="maxCovers"
              min={1}
              required
              defaultValue={defaults?.maxCovers ?? 4}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">
          Sort order <span className="font-normal text-zinc-500">(display order in the staff diary)</span>
        </span>
        <input
          type="number"
          name="sortOrder"
          defaultValue={defaults?.sortOrder ?? 0}
          className="w-32 rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaults?.active ?? true}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <span className="text-sm font-medium text-zinc-700">
          Active <span className="font-normal text-zinc-500">(available for auto-assignment and manual seating)</span>
        </span>
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
