/**
 * Plain-English read-back of a booking type form, shown live beside the form
 * so whoever is setting it up can see what customers will actually get, and
 * a list of problems to fix before saving. Pure functions: no React, no
 * database, so they can be checked on their own.
 */

export interface SummaryInput {
  name: string;
  active: boolean;
  isPrivateHireType: boolean;
  minPartySize: number | null;
  maxPartySize: number | null;
  minDurationMinutes: number | null;
  maxDurationMinutes: number | null;
  runsUntilClose: boolean;
  days: number[];
  windows: Record<number, { earliest: string; latest: string }>;
  bookingCutoffDays: number | null;
  hasAreas: boolean;
  areaNames: string[];
  tableFillMode: string;
  depositType: string;
  depositPounds: number | null;
  preOrderMode: "none" | "onDay" | "inFull";
  menuName: string | null;
  enquiryThresholdPartySize: number | null;
  autoConfirmMinLeadMinutes: number | null;
  dateExceptions: { from: string; to: string; start: string; end: string }[];
  // Optional so older callers and checks still work.
  capacityMode?: "TABLES" | "TICKETED";
  ticketCapacity?: number | null;
  minLeadMinutes?: number | null;
  maxDaysAhead?: number | null;
  waitlistEnabled?: boolean;
  requiresAgeConfirmation?: boolean;
  cardGuarantee?: boolean;
  noShowFeePounds?: number | null;
  noShowFeePerGuest?: boolean;
  minSpendPounds?: number | null;
  minSpendPerGuest?: boolean;
  minSpendPrepaid?: boolean;
  isGroupParty?: boolean;
  preOrderDeadlineDays?: number | null;
  maxCoversPerInterval?: number | null;
  coversIntervalMinutes?: number | null;
  extras?: string[];
}

export interface Summary {
  lines: string[];
  warnings: string[];
}

/** Monday-first, the way the venues think about their week. 0 = Sunday. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} minutes`;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}

export function formatDays(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "every day";
  const ordered = DAY_ORDER.filter((d) => set.has(d));
  if (ordered.length === 0) return "";
  const positions = ordered.map((d) => DAY_ORDER.indexOf(d));
  const contiguous = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
  if (contiguous && ordered.length >= 3) {
    return `${DAY_SHORT[ordered[0]]} to ${DAY_SHORT[ordered[ordered.length - 1]]}`;
  }
  if (ordered.length === 1) return `${DAY_LONG[ordered[0]]}s`;
  const names = ordered.map((d) => DAY_SHORT[d]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function formatPounds(pounds: number): string {
  return `£${pounds.toFixed(2).replace(/\.00$/, "")}`;
}

function windowPhrase(w: { earliest: string; latest: string } | undefined): string {
  if (!w || (!w.earliest && !w.latest)) return "arrivals during opening hours";
  if (!w.earliest || !w.latest) return "times half set";
  const overnight = w.latest <= w.earliest ? " (past midnight)" : "";
  return `arrivals ${w.earliest} to ${w.latest}${overnight}`;
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function buildSummary(s: SummaryInput): Summary {
  const lines: string[] = [];
  const warnings: string[] = [];

  if (!s.name.trim()) warnings.push("Give it a name.");

  lines.push(s.active ? "Shown on the booking page." : "Switched off, so customers can't see it.");
  if (s.isPrivateHireType) lines.push("Private hire: can use your private-hire-only days and hours.");
  if (s.requiresAgeConfirmation) lines.push("Over 18s only: guests confirm their age when booking.");

  // Who
  const minP = s.minPartySize;
  const maxP = s.maxPartySize;
  if (minP == null || maxP == null || minP < 1 || maxP < 1) {
    warnings.push("Set the smallest and largest group size.");
  } else if (minP > maxP) {
    warnings.push("The smallest group is bigger than the largest.");
  } else if (minP === maxP) {
    lines.push(`Groups of exactly ${minP}.`);
  } else if (minP === 1) {
    lines.push(`Up to ${maxP} guests.`);
  } else {
    lines.push(`Groups of ${minP} to ${maxP} guests.`);
  }

  if (s.capacityMode === "TICKETED") {
    if (!s.ticketCapacity || s.ticketCapacity < 1) warnings.push("Set how many places each session has.");
    else lines.push(`${s.ticketCapacity} places per session, no tables used.`);
  }

  // How long
  if (s.runsUntilClose) {
    lines.push("Stays until closing time.");
  } else if (s.minDurationMinutes != null && s.maxDurationMinutes != null) {
    if (s.minDurationMinutes > s.maxDurationMinutes) {
      warnings.push("The shortest stay is longer than the longest.");
    } else if (s.minDurationMinutes === s.maxDurationMinutes) {
      lines.push(`Stays ${formatDuration(s.minDurationMinutes)}.`);
    } else {
      lines.push(
        `Stays ${formatDuration(s.minDurationMinutes)} to ${formatDuration(s.maxDurationMinutes)}, the guest picks.`,
      );
    }
  }

  // When
  if (s.days.length === 0) {
    warnings.push("Not bookable on any day yet. Tick at least one day.");
  } else {
    const groups = new Map<string, number[]>();
    for (const d of DAY_ORDER) {
      if (!s.days.includes(d)) continue;
      const w = s.windows[d];
      const key = `${w?.earliest ?? ""}|${w?.latest ?? ""}`;
      groups.set(key, [...(groups.get(key) ?? []), d]);
      if (w && Boolean(w.earliest) !== Boolean(w.latest)) {
        warnings.push(`${DAY_LONG[d]}: set both the first and last arrival, or leave both blank.`);
      } else if (w && w.earliest && w.earliest === w.latest) {
        warnings.push(`${DAY_LONG[d]}: the first and last arrival can't be the same time.`);
      }
    }
    for (const [, groupDays] of groups) {
      lines.push(`${capitalise(formatDays(groupDays))}, ${windowPhrase(s.windows[groupDays[0]])}.`);
    }
  }
  if (s.bookingCutoffDays != null && s.bookingCutoffDays > 0) {
    const n = s.bookingCutoffDays;
    lines.push(`Bookings close ${n} ${n === 1 ? "day" : "days"} before each arrival time.`);
  }

  if (s.minLeadMinutes) lines.push(`Online bookings close ${formatDuration(s.minLeadMinutes)} before arrival.`);
  if (s.maxDaysAhead) lines.push(`Bookable up to ${s.maxDaysAhead} days ahead.`);
  if (s.waitlistEnabled) lines.push("When it's full, guests can join a waitlist and are emailed if a time frees up.");

  // Where
  const fill =
    s.tableFillMode === "WHOLE_AREA"
      ? "each booking takes a whole area"
      : s.tableFillMode === "WHOLE_VENUE"
        ? "each booking takes the whole venue"
        : "using just enough tables for the group";
  if (s.capacityMode === "TICKETED") {
    // No seating line: ticketed sessions don't take tables.
  } else if (s.hasAreas && s.areaNames.length > 0) {
    lines.push(`Seats in ${list(s.areaNames)}, ${fill}.`);
  } else {
    lines.push(`${capitalise(s.hasAreas ? `any area, ${fill}` : fill)}.`);
  }

  // Payment
  const pay: string[] = [];
  if (s.depositType === "FIXED" || s.depositType === "PER_HEAD") {
    if (s.depositPounds == null || !(s.depositPounds > 0)) {
      warnings.push("Enter the deposit amount.");
    } else {
      pay.push(`${formatPounds(s.depositPounds)} deposit ${s.depositType === "FIXED" ? "per booking" : "per guest"}`);
    }
  }
  if (s.cardGuarantee) {
    if (s.noShowFeePounds == null || !(s.noShowFeePounds > 0)) {
      warnings.push("Enter the no-show fee for the card guarantee.");
    } else {
      pay.push(`card saved as a guarantee, ${formatPounds(s.noShowFeePounds)} ${s.noShowFeePerGuest ? "per guest" : "per booking"} if they don't show`);
    }
  }
  if (s.minSpendPounds != null && s.minSpendPounds > 0) {
    pay.push(
      `minimum spend ${formatPounds(s.minSpendPounds)} ${s.minSpendPerGuest ? "per guest" : "per booking"}${s.minSpendPrepaid ? ", taken up front as credit" : ""}`,
    );
  }
  if (s.preOrderMode !== "none" && s.isGroupParty) {
    if (!s.menuName) warnings.push("Choose the pre-order menu.");
    if (s.preOrderMode === "inFull") warnings.push("Group food choices are paid on the night, so switch the pre-order to paid on the day.");
    const close = s.preOrderDeadlineDays ? `${s.preOrderDeadlineDays} days before` : "24 hours before";
    pay.push(`each guest picks their own food from a shared link, closing ${close}`);
  } else if (s.preOrderMode !== "none") {
    if (!s.menuName) warnings.push("Choose the pre-order menu.");
    const menu = s.menuName ? ` from ${s.menuName}` : "";
    pay.push(s.preOrderMode === "inFull" ? `pre-order${menu}, paid in full when booking` : `pre-order${menu}, paid on the day`);
  }
  lines.push(pay.length > 0 ? `${capitalise(list(pay))}.` : "Nothing to pay when booking.");

  if (s.extras && s.extras.length > 0) lines.push(`Extras offered: ${list(s.extras)}.`);

  // Advanced
  if (s.maxCoversPerInterval) {
    lines.push(`At most ${s.maxCoversPerInterval} guests arriving in any ${formatDuration(s.coversIntervalMinutes ?? 30)}.`);
  }
  if (s.enquiryThresholdPartySize != null) {
    if (maxP != null && s.enquiryThresholdPartySize > maxP) {
      warnings.push("The enquiry limit is above the largest group, so it would never apply.");
    } else {
      lines.push(`Groups over ${s.enquiryThresholdPartySize} come in as enquiries for you to confirm.`);
    }
  }
  if (s.autoConfirmMinLeadMinutes != null && s.autoConfirmMinLeadMinutes > 0) {
    lines.push(
      `Bookings made less than ${formatDuration(s.autoConfirmMinLeadMinutes)} ahead come in as enquiries.`,
    );
  }

  s.dateExceptions.forEach((x, i) => {
    const label = `Date exception ${i + 1}`;
    if (!x.from || !x.to) warnings.push(`${label}: pick both dates.`);
    else if (x.to < x.from) warnings.push(`${label}: the end date is before the start date.`);
    if (Boolean(x.start) !== Boolean(x.end)) warnings.push(`${label}: set both times, or leave both blank for all day.`);
  });
  if (s.dateExceptions.length > 0) {
    const n = s.dateExceptions.length;
    lines.push(`${n} date ${n === 1 ? "exception" : "exceptions"} set.`);
  }

  return { lines, warnings };
}

/** The bits of FormData this needs, so a plain object can stand in for it in checks. */
export interface FormDataLike {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

export function readSummaryInput(
  fd: FormDataLike,
  areas: { id: string; name: string }[],
  menus: { id: string; name: string }[],
  addOns: { id: string; name: string }[] = [],
): SummaryInput {
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const num = (k: string) => {
    const v = str(k);
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const windows: SummaryInput["windows"] = {};
  for (let d = 0; d <= 6; d++) {
    windows[d] = { earliest: str(`dayWindow_${d}_earliest`), latest: str(`dayWindow_${d}_latest`) };
  }
  const requiresPreOrder = fd.get("requiresPreOrder") === "on";
  const paidInFull = fd.get("preOrderPaymentRequired") === "on";
  const menuId = str("preOrderMenuId");
  return {
    name: str("name"),
    active: fd.get("active") === "on",
    isPrivateHireType: fd.get("isPrivateHireType") === "on",
    minPartySize: num("minPartySize"),
    maxPartySize: num("maxPartySize"),
    minDurationMinutes: num("minDurationMinutes"),
    maxDurationMinutes: num("maxDurationMinutes"),
    runsUntilClose: fd.get("runsUntilClose") === "on",
    days: fd.getAll("availableDaysOfWeek").map((v) => Number(v)),
    windows,
    bookingCutoffDays: num("bookingCutoffDays"),
    hasAreas: areas.length > 0,
    areaNames: areas.filter((a) => fd.get(`area_${a.id}_selected`) === "on").map((a) => a.name),
    tableFillMode: str("tableFillMode") || "PER_BOOKING",
    depositType: str("depositType") || "NONE",
    depositPounds: num("depositAmountPounds"),
    preOrderMode: requiresPreOrder ? (paidInFull ? "inFull" : "onDay") : "none",
    menuName: menus.find((m) => m.id === menuId)?.name ?? null,
    enquiryThresholdPartySize: num("enquiryThresholdPartySize"),
    capacityMode: str("capacityMode") === "TICKETED" ? "TICKETED" : "TABLES",
    ticketCapacity: num("ticketCapacity"),
    minLeadMinutes: num("minLeadMinutes"),
    maxDaysAhead: num("maxDaysAhead"),
    waitlistEnabled: fd.get("waitlistEnabled") === "on",
    requiresAgeConfirmation: fd.get("requiresAgeConfirmation") === "on",
    cardGuarantee: str("depositChoice") === "CARD",
    noShowFeePounds: num("noShowFeePounds"),
    noShowFeePerGuest: str("noShowFeePerGuest") !== "off",
    minSpendPounds: num("minSpendPounds"),
    minSpendPerGuest: fd.get("minSpendPerGuest") === "on",
    minSpendPrepaid: fd.get("minSpendPrepaid") === "on",
    isGroupParty: fd.get("isGroupParty") === "on",
    preOrderDeadlineDays: num("preOrderDeadlineDays"),
    maxCoversPerInterval: num("maxCoversPerInterval"),
    coversIntervalMinutes: num("coversIntervalMinutes"),
    extras: addOns.filter((a) => fd.get(`addOn_${a.id}`) === "on").map((a) => a.name),
    autoConfirmMinLeadMinutes: num("autoConfirmMinLeadMinutes"),
    dateExceptions: fd.getAll("dateOverrideDateFrom").map((from, i) => ({
      from: String(from),
      to: String(fd.getAll("dateOverrideDateTo")[i] ?? ""),
      start: String(fd.getAll("dateOverrideStartTime")[i] ?? ""),
      end: String(fd.getAll("dateOverrideEndTime")[i] ?? ""),
    })),
  };
}

