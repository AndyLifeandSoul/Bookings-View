"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingType } from "@/generated/prisma";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { DateOverrideField, type DateOverrideRow } from "./date-override-field";
import { DayWindowsField } from "./day-windows-field";
import { PRESETS, type PresetId, type PresetValues } from "./booking-type-presets";
import { buildSummary, formatDuration, readSummaryInput, type Summary } from "./booking-type-summary";

type BookingTypeDefaults = BookingType & {
  dateOverrides?: { dateFrom: Date; dateTo: Date; startTime: string | null; endTime: string | null; allow: boolean; note: string | null }[];
  areaPriorities?: { areaId: string; priority: number }[];
  dayWindows?: { dayOfWeek: number; earliestBookingTime: string; latestBookingTime: string }[];
  addOns?: { addOnId: string }[];
};

type PreOrderMode = "none" | "onDay" | "inFull";

/** Everything the form starts from, whether that's a saved booking type or a preset. */
interface Initial {
  name: string;
  namePlaceholder: string;
  description: string;
  active: boolean;
  isPrivateHireType: boolean;
  color: string;
  minPartySize: number;
  maxPartySize: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  durationStepMinutes: number;
  startTimeStepMinutes: number;
  bufferMinutes: number;
  runsUntilClose: boolean;
  availableDaysOfWeek: number[];
  dayWindows: { dayOfWeek: number; earliestBookingTime: string; latestBookingTime: string }[];
  dateOverrides: DateOverrideRow[];
  areaPriorities: Map<string, number>;
  tableFillMode: string;
  enquiryThresholdPartySize: number | null;
  autoConfirmMinLeadMinutes: number | null;
  bookingCutoffDays: number | null;
  depositType: string;
  depositPounds: string;
  preOrderMode: PreOrderMode;
  preOrderMenuId: string;
  preOrderMinItemsPerPerson: number | null;
  preOrderMaxItemsPerPerson: number | null;
  sortOrder: number;
  minLeadMinutes: number | null;
  maxDaysAhead: number | null;
  maxCoversPerInterval: number | null;
  coversIntervalMinutes: number;
  minSpendPounds: string;
  minSpendPerGuest: boolean;
  minSpendPrepaid: boolean;
  requiresAgeConfirmation: boolean;
  capacityMode: "TABLES" | "TICKETED";
  ticketCapacity: number | null;
  waitlistEnabled: boolean;
  preOrderDeadlineDays: number | null;
  isGroupParty: boolean;
  noShowFeePounds: string;
  noShowFeePerGuest: boolean;
  addOnIds: Set<string>;
}

function fromSaved(d: BookingTypeDefaults): Initial {
  return {
    name: d.name,
    namePlaceholder: d.name,
    description: d.description ?? "",
    active: d.active,
    isPrivateHireType: d.isPrivateHireType,
    color: d.color ?? "#7c3aed",
    minPartySize: d.minPartySize,
    maxPartySize: d.maxPartySize,
    minDurationMinutes: d.minDurationMinutes,
    maxDurationMinutes: d.maxDurationMinutes,
    durationStepMinutes: d.durationStepMinutes,
    startTimeStepMinutes: d.startTimeStepMinutes,
    bufferMinutes: d.bufferMinutes,
    runsUntilClose: d.runsUntilClose,
    availableDaysOfWeek: d.availableDaysOfWeek,
    dayWindows: d.dayWindows ?? [],
    dateOverrides: (d.dateOverrides ?? []).map((o) => ({
      dateFrom: new Date(o.dateFrom).toISOString().slice(0, 10),
      dateTo: new Date(o.dateTo).toISOString().slice(0, 10),
      startTime: o.startTime ?? "",
      endTime: o.endTime ?? "",
      allow: o.allow,
      note: o.note ?? "",
    })),
    areaPriorities: new Map((d.areaPriorities ?? []).map((p) => [p.areaId, p.priority])),
    tableFillMode: d.tableFillMode,
    enquiryThresholdPartySize: d.enquiryThresholdPartySize,
    autoConfirmMinLeadMinutes: d.autoConfirmMinLeadMinutes,
    bookingCutoffDays: d.bookingCutoffDays,
    depositType: d.depositType,
    depositPounds: d.depositAmount != null ? (d.depositAmount / 100).toFixed(2) : "",
    preOrderMode: d.requiresPreOrder ? (d.preOrderPaymentRequired ? "inFull" : "onDay") : "none",
    preOrderMenuId: d.preOrderMenuId ?? "",
    preOrderMinItemsPerPerson: d.preOrderMinItemsPerPerson,
    preOrderMaxItemsPerPerson: d.preOrderMaxItemsPerPerson,
    sortOrder: d.sortOrder,
    minLeadMinutes: d.minLeadMinutes,
    maxDaysAhead: d.maxDaysAhead,
    maxCoversPerInterval: d.maxCoversPerInterval,
    coversIntervalMinutes: d.coversIntervalMinutes,
    minSpendPounds: d.minSpendPence != null ? (d.minSpendPence / 100).toString() : "",
    minSpendPerGuest: d.minSpendPerGuest,
    minSpendPrepaid: d.minSpendPrepaid,
    requiresAgeConfirmation: d.requiresAgeConfirmation,
    capacityMode: d.capacityMode,
    ticketCapacity: d.ticketCapacity,
    waitlistEnabled: d.waitlistEnabled,
    preOrderDeadlineDays: d.preOrderDeadlineDays,
    isGroupParty: d.isGroupParty,
    noShowFeePounds: d.noShowFeePence != null ? (d.noShowFeePence / 100).toString() : "",
    noShowFeePerGuest: d.noShowFeePerGuest,
    addOnIds: new Set((d.addOns ?? []).map((a) => a.addOnId)),
  };
}

function fromPreset(p: PresetValues, label: string): Initial {
  return {
    name: p.name,
    namePlaceholder: p.name || label,
    description: "",
    active: true,
    isPrivateHireType: p.isPrivateHireType,
    color: "#7c3aed",
    minPartySize: p.minPartySize,
    maxPartySize: p.maxPartySize,
    minDurationMinutes: p.minDurationMinutes,
    maxDurationMinutes: p.maxDurationMinutes,
    durationStepMinutes: p.durationStepMinutes,
    startTimeStepMinutes: p.startTimeStepMinutes,
    bufferMinutes: p.bufferMinutes,
    runsUntilClose: p.runsUntilClose,
    availableDaysOfWeek: p.availableDaysOfWeek,
    dayWindows: p.dayWindows,
    dateOverrides: [],
    areaPriorities: new Map(),
    tableFillMode: p.tableFillMode,
    enquiryThresholdPartySize: p.enquiryThresholdPartySize ?? null,
    autoConfirmMinLeadMinutes: null,
    bookingCutoffDays: p.bookingCutoffDays,
    depositType: p.depositType ?? "NONE",
    depositPounds: p.depositPounds ?? "",
    preOrderMode: p.requiresPreOrder ? (p.preOrderPaymentRequired ? "inFull" : "onDay") : "none",
    preOrderMenuId: "",
    preOrderMinItemsPerPerson: p.preOrderMinItemsPerPerson,
    preOrderMaxItemsPerPerson: p.preOrderMaxItemsPerPerson,
    sortOrder: 0,
    minLeadMinutes: p.minLeadMinutes ?? null,
    maxDaysAhead: null,
    maxCoversPerInterval: null,
    coversIntervalMinutes: 30,
    minSpendPounds: "",
    minSpendPerGuest: false,
    minSpendPrepaid: false,
    requiresAgeConfirmation: p.requiresAgeConfirmation ?? false,
    capacityMode: p.capacityMode ?? "TABLES",
    ticketCapacity: p.ticketCapacity ?? null,
    waitlistEnabled: p.waitlistEnabled ?? false,
    preOrderDeadlineDays: p.preOrderDeadlineDays ?? null,
    isGroupParty: p.isGroupParty ?? false,
    noShowFeePounds: "",
    noShowFeePerGuest: true,
    addOnIds: new Set(),
  };
}

/**
 * The create and edit form for a booking type, shared so the two can't
 * drift apart. A new booking type starts from a preset; editing starts from
 * the saved values. Every input keeps the exact name and format the server
 * actions in actions.ts already read, so this is a change to how the form
 * looks and behaves, not to what gets saved.
 */
export function BookingTypeFields({
  defaults,
  areas,
  menus,
  submitLabel,
  addOns = [],
}: {
  defaults?: BookingTypeDefaults;
  /** Every area for this venue, for the area picker. */
  areas: { id: string; name: string }[];
  /** The venue's active pre-order menus. */
  menus: { id: string; name: string }[];
  submitLabel: string;
  /** The venue's extras, to choose which this type offers. */
  addOns?: { id: string; name: string; pricePence: number; perGuest: boolean }[];
}) {
  const [presetId, setPresetId] = useState<PresetId | null>(null);

  if (defaults) {
    return <FormBody initial={fromSaved(defaults)} editingId={defaults.id} areas={areas} menus={menus} addOns={addOns} submitLabel={submitLabel} />;
  }

  const preset = PRESETS.find((p) => p.id === presetId);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-sm)]">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">What are people booking?</h3>
          <p className="mt-0.5 text-sm text-zinc-500">
            Pick the closest match and we&apos;ll fill in sensible settings. You can change any of them before saving.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => {
            const on = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                aria-pressed={on}
                className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)]"
                    : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span className="text-sm font-semibold">{p.label}</span>
                <span className={`text-xs ${on ? "" : "text-zinc-500"}`}>{p.blurb}</span>
              </button>
            );
          })}
        </div>
        {preset && (
          <p className="text-xs text-zinc-500">Switching to a different one resets the settings below.</p>
        )}
      </section>

      {preset && (
        <FormBody
          key={preset.id}
          initial={fromPreset(preset.values, preset.label)}
          areas={areas}
          menus={menus}
          addOns={addOns}
          submitLabel={submitLabel}
        />
      )}
    </div>
  );
}

const DURATIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 15);

function withCurrent(options: number[], current: number | null): number[] {
  if (current == null || options.includes(current)) return options;
  return [...options, current].sort((a, b) => a - b);
}

const inputClass = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900";
const selectClass = "rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900";

function Section({ title, hint, hidden, children }: { title: string; hint?: string; hidden?: boolean; children: React.ReactNode }) {
  return (
    <section hidden={hidden} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-sm)]">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        checked ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-zinc-200 hover:bg-zinc-50"
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4" />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-zinc-900">{title}</span>
        {detail && <span className="text-xs text-zinc-500">{detail}</span>}
      </span>
    </label>
  );
}

function FormBody({
  initial,
  editingId,
  areas,
  menus,
  addOns,
  submitLabel,
}: {
  initial: Initial;
  editingId?: string;
  areas: { id: string; name: string }[];
  menus: { id: string; name: string }[];
  addOns: { id: string; name: string; pricePence: number; perGuest: boolean }[];
  submitLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const [runsUntilClose, setRunsUntilClose] = useState(initial.runsUntilClose);
  const [depositType, setDepositType] = useState(initial.depositType === "NONE" && initial.noShowFeePounds ? "CARD" : initial.depositType);
  const [capacityMode, setCapacityMode] = useState(initial.capacityMode);
  // 0 is stored for "always an enquiry" (every party size is bigger than 0),
  // null for "confirm straight away", and a positive number for the old
  // "groups bigger than N" rule.
  const [enquiryMode, setEnquiryMode] = useState<"none" | "over" | "always">(
    initial.enquiryThresholdPartySize === 0 ? "always" : initial.enquiryThresholdPartySize == null ? "none" : "over",
  );
  const [isGroupParty, setIsGroupParty] = useState(initial.isGroupParty);
  const [preOrderMode, setPreOrderMode] = useState<PreOrderMode>(initial.preOrderMode);
  const [fillMode, setFillMode] = useState(initial.tableFillMode);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [summary, setSummary] = useState<Summary>({ lines: [], warnings: [] });

  // The read-back is worked out from the form itself, so it always matches
  // what will actually be submitted. setTimeout lets React finish applying
  // the change that triggered it first.
  const recompute = useCallback(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    setSummary(buildSummary(readSummaryInput(new FormData(form), areas, menus, addOns)));
  }, [areas, menus, addOns]);
  const schedule = useCallback(() => {
    setTimeout(recompute, 0);
  }, [recompute]);

  useEffect(() => {
    const id = setTimeout(recompute, 0);
    const form = rootRef.current?.closest("form");
    form?.addEventListener("reset", schedule);
    return () => {
      clearTimeout(id);
      form?.removeEventListener("reset", schedule);
    };
  }, [recompute, schedule]);

  // A browser validation error on a field inside the closed "More settings"
  // panel would block saving with nothing visible to fix, so open it. The
  // invalid event doesn't bubble, hence the capture listener.
  useEffect(() => {
    const el = advancedRef.current;
    if (!el) return;
    const open = () => setAdvancedOpen(true);
    el.addEventListener("invalid", open, true);
    return () => el.removeEventListener("invalid", open, true);
  }, []);

  const durations = withCurrent(withCurrent(DURATIONS, initial.minDurationMinutes), initial.maxDurationMinutes);

  return (
    <div
      ref={rootRef}
      onChange={schedule}
      onInput={schedule}
      onClick={schedule}
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      {editingId && <input type="hidden" name="id" value={editingId} />}

      <div className="flex min-w-0 flex-col gap-5">
        <Section title="The basics">
          <Field label="Name" hint="What customers see when they choose how to book.">
            <input
              type="text"
              name="name"
              required
              defaultValue={initial.name}
              placeholder={initial.namePlaceholder}
              className={`${inputClass} sm:max-w-md`}
            />
          </Field>
          <Field label="Short description (optional)" hint="Shown under the name on the booking page.">
            <textarea name="description" defaultValue={initial.description} rows={2} className={inputClass} />
          </Field>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="active" defaultChecked={initial.active} className="mt-0.5 h-4 w-4 rounded border-zinc-300" />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-zinc-800">Show on the booking page</span>
              <span className="text-xs text-zinc-500">Untick to hide it from customers without deleting it.</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="isPrivateHireType"
              defaultChecked={initial.isPrivateHireType}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-zinc-800">This is private hire</span>
              <span className="text-xs text-zinc-500">
                Lets it be booked on days or hours you&apos;ve set to private hire only in Opening hours. Leave unticked
                for everyday bookings.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="requiresAgeConfirmation"
              defaultChecked={initial.requiresAgeConfirmation}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-zinc-800">Over 18s only</span>
              <span className="text-xs text-zinc-500">Guests confirm everyone in their group is 18 or over, and are reminded to bring ID.</span>
            </span>
          </label>
        </Section>

        <Section title="Who and how long">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Smallest group">
              <input type="number" name="minPartySize" min={1} required defaultValue={initial.minPartySize} className={`${inputClass} w-28`} />
            </Field>
            <Field label="Largest group">
              <input type="number" name="maxPartySize" min={1} required defaultValue={initial.maxPartySize} className={`${inputClass} w-28`} />
            </Field>
            <span className="pb-2 text-sm text-zinc-500">guests</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-800">How places are counted</span>
            <Choice
              name="capacityMode"
              value="TABLES"
              checked={capacityMode === "TABLES"}
              onChange={() => setCapacityMode("TABLES")}
              title="Tables"
              detail="Each booking gets a table. The usual choice."
            />
            <Choice
              name="capacityMode"
              value="TICKETED"
              checked={capacityMode === "TICKETED"}
              onChange={() => setCapacityMode("TICKETED")}
              title="Places per session"
              detail="Sold by headcount up to a limit, no tables: masterclasses, quiz nights, events. Set a price per guest under Payment."
            />
            <div hidden={capacityMode !== "TICKETED"} className="ml-1">
              <Field label="Places per session">
                <input type="number" name="ticketCapacity" min={1} defaultValue={initial.ticketCapacity ?? ""} className={`${inputClass} w-28`} />
              </Field>
            </div>
          </div>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="runsUntilClose"
              checked={runsUntilClose}
              onChange={(e) => setRunsUntilClose(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-zinc-800">They keep the table until closing time</span>
              <span className="text-xs text-zinc-500">For nights out where the table is theirs for the rest of the night.</span>
            </span>
          </label>

          {/* Still submitted when hidden: the actions need valid lengths either way. */}
          <div hidden={runsUntilClose} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Shortest stay">
                <select name="minDurationMinutes" defaultValue={initial.minDurationMinutes} className={selectClass}>
                  {durations.map((m) => (
                    <option key={m} value={m}>
                      {formatDuration(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Longest stay">
                <select name="maxDurationMinutes" defaultValue={initial.maxDurationMinutes} className={selectClass}>
                  {durations.map((m) => (
                    <option key={m} value={m}>
                      {formatDuration(m)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <span className="text-xs text-zinc-500">
              Set both the same for a fixed length. If they differ, the guest picks how long they want when booking.
            </span>
          </div>
        </Section>

        <Section title="When people can book" hint="Tick the days this runs. Times are optional.">
          <DayWindowsField selectedDays={initial.availableDaysOfWeek} dayWindows={initial.dayWindows} />
          <Field
            label="Stop taking bookings"
            hint="Counted to the minute from each arrival time. With 2 days, a 3pm Saturday table stops being bookable at 3pm on Thursday. Applies to online bookings; staff can still add them in the diary."
          >
            <select name="bookingCutoffDays" defaultValue={initial.bookingCutoffDays ?? ""} className={`${selectClass} w-fit`}>
              <option value="">Right up until they arrive</option>
              {withCurrent(
                Array.from({ length: 14 }, (_, i) => i + 1),
                initial.bookingCutoffDays && initial.bookingCutoffDays > 0 ? initial.bookingCutoffDays : null,
              ).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "day" : "days"} before
                </option>
              ))}
              {initial.bookingCutoffDays === 0 && <option value={0}>0 days before</option>}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum notice" hint="Online bookings must be made at least this long before arrival.">
              <select name="minLeadMinutes" defaultValue={initial.minLeadMinutes ?? ""} className={`${selectClass} w-fit`}>
                <option value="">None, book right up to the time</option>
                {withCurrent([30, 60, 120, 180, 360, 720, 1440, 2880], initial.minLeadMinutes).map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Open for bookings" hint="How far ahead guests can book online.">
              <select name="maxDaysAhead" defaultValue={initial.maxDaysAhead ?? ""} className={`${selectClass} w-fit`}>
                <option value="">Any time ahead</option>
                {withCurrent([7, 14, 30, 60, 90, 180, 365], initial.maxDaysAhead).map((d) => (
                  <option key={d} value={d}>
                    Up to {d} days ahead
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="waitlistEnabled" defaultChecked={initial.waitlistEnabled} className="mt-0.5 h-4 w-4 rounded border-zinc-300" />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-zinc-800">Offer a waitlist when it&apos;s full</span>
              <span className="text-xs text-zinc-500">Guests leave their details; we email them automatically if a time frees up.</span>
            </span>
          </label>
        </Section>

        <Section title="Where they sit" hidden={capacityMode === "TICKETED"}>
          {areas.length === 0 ? (
            <p className="text-sm text-zinc-500">No areas set up for this venue yet, so any table can be used. Add areas under Tables.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-800">Areas</span>
              <span className="-mt-1 text-xs text-zinc-500">
                Tick the areas this can use, or leave them all unticked to use any area. Lower numbers fill first.
              </span>
              <div className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {areas.map((area) => (
                  <div key={area.id} className="flex items-center gap-3 px-3 py-2">
                    <label className="flex flex-1 items-center gap-2 text-sm text-zinc-800">
                      <input
                        type="checkbox"
                        name={`area_${area.id}_selected`}
                        defaultChecked={initial.areaPriorities.has(area.id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      {area.name}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                      Fill order
                      <input
                        type="number"
                        name={`area_${area.id}_priority`}
                        defaultValue={initial.areaPriorities.get(area.id) ?? 0}
                        className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-800">How much space each booking takes</span>
            <Choice
              name="tableFillMode"
              value="PER_BOOKING"
              checked={fillMode === "PER_BOOKING"}
              onChange={() => setFillMode("PER_BOOKING")}
              title="Just enough tables for the group"
              detail="The usual choice for food and drinks tables."
            />
            <Choice
              name="tableFillMode"
              value="WHOLE_AREA"
              checked={fillMode === "WHOLE_AREA"}
              onChange={() => setFillMode("WHOLE_AREA")}
              title="A whole area"
              detail="Every table in one area is held for the booking. Staff choose which area."
            />
            <Choice
              name="tableFillMode"
              value="WHOLE_VENUE"
              checked={fillMode === "WHOLE_VENUE"}
              onChange={() => setFillMode("WHOLE_VENUE")}
              title="The whole venue"
              detail="Every table is held, so nobody else can book that time."
            />
          </div>
        </Section>

        <Section title="Payment">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-800">{capacityMode === "TICKETED" ? "Ticket price or deposit" : "Deposit"}</span>
            <input type="hidden" name="depositType" value={depositType === "CARD" ? "NONE" : depositType} />
            <Choice name="depositChoice" value="NONE" checked={depositType === "NONE"} onChange={() => setDepositType("NONE")} title="Nothing up front" />
            <Choice
              name="depositChoice"
              value="CARD"
              checked={depositType === "CARD"}
              onChange={() => setDepositType("CARD")}
              title="Card guarantee"
              detail="Guests save a card, nothing is charged. You can charge a no-show or late-cancel fee once."
            />
            <div hidden={depositType !== "CARD"} className="ml-1 mt-1 flex flex-wrap items-end gap-3">
              <Field label="No-show fee">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm text-zinc-500">£</span>
                  <input type="number" name="noShowFeePounds" min={0} step="any" disabled={depositType !== "CARD"} defaultValue={initial.noShowFeePounds} className={`${inputClass} w-28`} />
                </span>
              </Field>
              <select name="noShowFeePerGuest" defaultValue={initial.noShowFeePerGuest ? "on" : "off"} className={selectClass} aria-label="Fee per guest or per booking">
                <option value="on">per guest</option>
                <option value="off">per booking</option>
              </select>
            </div>
            <Choice
              name="depositChoice"
              value="FIXED"
              checked={depositType === "FIXED"}
              onChange={() => setDepositType("FIXED")}
              title="A set amount per booking"
            />
            <Choice
              name="depositChoice"
              value="PER_HEAD"
              checked={depositType === "PER_HEAD"}
              onChange={() => setDepositType("PER_HEAD")}
              title={capacityMode === "TICKETED" ? "A price per guest (ticket)" : "An amount per guest"}
            />
            <div hidden={depositType === "NONE" || depositType === "CARD"} className="ml-1 mt-1">
              <Field label={depositType === "PER_HEAD" ? "Amount per guest" : "Amount per booking"}>
                <span className="flex items-center gap-1.5">
                  <span className="text-sm text-zinc-500">£</span>
                  <input
                    type="number"
                    name="depositAmountPounds"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    defaultValue={initial.depositPounds}
                    className={`${inputClass} w-32`}
                  />
                </span>
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-800">Minimum spend</span>
            <div className="flex flex-wrap items-end gap-3">
              <span className="flex items-center gap-1.5">
                <span className="text-sm text-zinc-500">£</span>
                <input type="number" name="minSpendPounds" min={0} step="any" aria-label="Minimum spend" placeholder="None" defaultValue={initial.minSpendPounds} className={`${inputClass} w-28`} />
              </span>
              <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
                <input type="checkbox" name="minSpendPerGuest" defaultChecked={initial.minSpendPerGuest} className="h-4 w-4 rounded border-zinc-300" />
                per guest
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
                <input type="checkbox" name="minSpendPrepaid" defaultChecked={initial.minSpendPrepaid} className="h-4 w-4 rounded border-zinc-300" />
                take it up front as credit
              </label>
            </div>
            <span className="text-xs text-zinc-500">Shown to guests when they book. For booths and VIP tables.</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-800">Pre-order</span>
            {preOrderMode !== "none" && <input type="hidden" name="requiresPreOrder" value="on" />}
            {preOrderMode === "inFull" && <input type="hidden" name="preOrderPaymentRequired" value="on" />}
            <Choice
              name="preOrderMode"
              value="none"
              checked={preOrderMode === "none"}
              onChange={() => setPreOrderMode("none")}
              title="No pre-order"
            />
            <Choice
              name="preOrderMode"
              value="onDay"
              checked={preOrderMode === "onDay"}
              onChange={() => setPreOrderMode("onDay")}
              title="Choose from a menu when booking, pay on the day"
            />
            <Choice
              name="preOrderMode"
              value="inFull"
              checked={preOrderMode === "inFull"}
              onChange={() => setPreOrderMode("inFull")}
              title="Choose from a menu and pay in full when booking"
              detail="The booking only confirms once the payment goes through."
            />
            <div hidden={preOrderMode === "none"} className="ml-1 mt-1 flex flex-col gap-3">
              <Field
                label="Menu"
                hint={menus.length === 0 ? "No menus yet. Build one under Menus first." : "Menus are shared, so several booking types can use the same one."}
              >
                <select name="preOrderMenuId" defaultValue={initial.preOrderMenuId} className={`${selectClass} sm:max-w-xs`}>
                  <option value="">Choose a menu</option>
                  {menus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="At least">
                    <input
                      type="number"
                      name="preOrderMinItemsPerPerson"
                      min={0}
                      defaultValue={initial.preOrderMinItemsPerPerson ?? ""}
                      placeholder="Any"
                      className={`${inputClass} w-24`}
                    />
                  </Field>
                  <Field label="At most">
                    <input
                      type="number"
                      name="preOrderMaxItemsPerPerson"
                      min={0}
                      defaultValue={initial.preOrderMaxItemsPerPerson ?? ""}
                      placeholder="Any"
                      className={`${inputClass} w-24`}
                    />
                  </Field>
                  <span className="pb-2 text-sm text-zinc-500">items per guest</span>
                </div>
                <span className="text-xs text-zinc-500">For bottomless brunch, set both to 1. Leave blank for no limit.</span>
              </div>
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="isGroupParty"
                  checked={isGroupParty}
                  onChange={(e) => setIsGroupParty(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-800">Each guest picks their own food</span>
                  <span className="text-xs text-zinc-500">
                    For Christmas parties and big groups: the organiser books, then shares a link so everyone chooses. Food is paid on the night.
                  </span>
                </span>
              </label>
              <div hidden={!isGroupParty}>
                <Field label="Food choices close">
                  <select name="preOrderDeadlineDays" defaultValue={initial.preOrderDeadlineDays ?? ""} className={`${selectClass} w-fit`}>
                    <option value="">24 hours before</option>
                    {withCurrent([2, 3, 5, 7, 10, 14, 21], initial.preOrderDeadlineDays).map((d) => (
                      <option key={d} value={d}>
                        {d} days before
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Extras" hint="Optional add-ons guests can choose when booking this.">
          {addOns.length === 0 ? (
            <p className="text-sm text-zinc-500">No extras set up yet. Add things like prosecco on arrival or a birthday cake under Settings, Extras.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {addOns.map((a) => (
                <label key={a.id} className="flex items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                  <input type="checkbox" name={`addOn_${a.id}`} defaultChecked={initial.addOnIds.has(a.id)} className="h-4 w-4 rounded border-zinc-300" />
                  <span className="flex-1 text-zinc-800">{a.name}</span>
                  <span className="text-xs text-zinc-500">
                    £{(a.pricePence / 100).toFixed(2)}
                    {a.perGuest ? " pp" : ""}
                  </span>
                </label>
              ))}
            </div>
          )}
        </Section>

        <details
          ref={advancedRef}
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
          className="group rounded-2xl border border-zinc-200/80 bg-white [box-shadow:var(--shadow-sm)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-900">More settings</span>
              <span className="text-sm text-zinc-500">Start time gaps, enquiries, date exceptions and diary colour.</span>
            </span>
            <span className="text-zinc-400 transition-transform group-open:rotate-180" aria-hidden="true">
              ▾
            </span>
          </summary>
          <div className="flex flex-col gap-5 border-t border-zinc-100 px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Offer start times every" hint="15 minutes gives 18:00, 18:15, 18:30 and so on.">
                <select name="startTimeStepMinutes" defaultValue={initial.startTimeStepMinutes} className={`${selectClass} w-fit`}>
                  {withCurrent([5, 10, 15, 20, 30, 60], initial.startTimeStepMinutes).map((m) => (
                    <option key={m} value={m}>
                      {formatDuration(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Length choices go up in" hint="Only matters when the shortest and longest stay differ.">
                <select name="durationStepMinutes" defaultValue={initial.durationStepMinutes} className={`${selectClass} w-fit`}>
                  {withCurrent([5, 10, 15, 30, 60], initial.durationStepMinutes).map((m) => (
                    <option key={m} value={m}>
                      {formatDuration(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reset time after each booking" hint="Keeps the table free this long after a booking ends.">
                <select name="bufferMinutes" defaultValue={initial.bufferMinutes} className={`${selectClass} w-fit`}>
                  {withCurrent([0, 5, 10, 15, 20, 30, 45, 60], initial.bufferMinutes).map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "None" : formatDuration(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Online bookings"
                hint={
                  enquiryMode === "always"
                    ? "Every booking of this type waits for staff to confirm it in the diary, whatever the group size."
                    : enquiryMode === "over"
                      ? "Bigger groups wait for staff to confirm them in the diary."
                      : "Every booking is confirmed straight away."
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    name="enquiryMode"
                    value={enquiryMode}
                    onChange={(e) => setEnquiryMode(e.target.value as "none" | "over" | "always")}
                    className={`${selectClass} w-fit`}
                  >
                    <option value="none">Confirm straight away</option>
                    <option value="over">Enquiry for groups bigger than</option>
                    <option value="always">Always an enquiry</option>
                  </select>
                  {enquiryMode === "over" && (
                    <input
                      type="number"
                      name="enquiryThresholdPartySize"
                      min={1}
                      required
                      defaultValue={initial.enquiryThresholdPartySize && initial.enquiryThresholdPartySize > 0 ? initial.enquiryThresholdPartySize : ""}
                      aria-label="Group size"
                      className={`${inputClass} w-24`}
                    />
                  )}
                </div>
              </Field>
              <Field
                label="Bookings with less notice than this come in as enquiries"
                hint="Online bookings only. Staff confirm them in the diary."
              >
                <select
                  name="autoConfirmMinLeadMinutes"
                  defaultValue={initial.autoConfirmMinLeadMinutes ?? ""}
                  className={`${selectClass} w-fit`}
                >
                  <option value="">Always confirm straight away</option>
                  {withCurrent([30, 60, 120, 180, 360, 720, 1440, 2880], initial.autoConfirmMinLeadMinutes).map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "No notice needed" : formatDuration(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Most guests arriving together" hint="Caps guests starting in any window, to pace the kitchen. Blank for no cap.">
                <span className="flex items-center gap-1.5">
                  <input type="number" name="maxCoversPerInterval" min={1} defaultValue={initial.maxCoversPerInterval ?? ""} placeholder="No cap" className={`${inputClass} w-24`} />
                  <span className="text-sm text-zinc-500">per</span>
                  <select name="coversIntervalMinutes" defaultValue={initial.coversIntervalMinutes} className={selectClass}>
                    {withCurrent([15, 30, 60], initial.coversIntervalMinutes).map((m) => (
                      <option key={m} value={m}>
                        {formatDuration(m)}
                      </option>
                    ))}
                  </select>
                </span>
              </Field>
              <Field label="Position in the list" hint="Lower numbers show first on the booking page.">
                <input type="number" name="sortOrder" defaultValue={initial.sortOrder} className={`${inputClass} w-24`} />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-800">Date exceptions</span>
              <span className="-mt-1 text-xs text-zinc-500">
                Open or close this on particular dates, whatever the ticked days say. Lower rows win where two overlap.
              </span>
              <DateOverrideField defaultRows={initial.dateOverrides} />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-800">Diary colour</span>
              <ColorSwatchPicker name="color" defaultValue={initial.color} />
            </div>
          </div>
        </details>
      </div>

      <aside className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-sm)] lg:sticky lg:top-20">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">What customers will get</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Updates as you change the form.</p>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm text-zinc-700">
          {summary.lines.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {summary.warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-900">Before saving</p>
            <ul className="mt-1 flex flex-col gap-1 text-xs text-amber-900">
              {summary.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
            Ready to save.
          </p>
        )}
        <SubmitButton label={submitLabel} pendingLabel="Saving..." className={buttonStyles("primary", "md", "w-full")} />
      </aside>
    </div>
  );
}
