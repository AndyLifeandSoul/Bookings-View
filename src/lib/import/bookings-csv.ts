/**
 * Reads a bookings export from another booking system (built around the
 * Collins / DesignMyNight export, and tolerant of simpler spreadsheets with
 * columns like Name, Date, Time, Guests, Type) into rows ready to import.
 * Pure: no database, so the preview and the import read a file the same way.
 */

export type ImportStatus = "CONFIRMED" | "ENQUIRY";

export interface ImportRow {
  /** 1-based line in the file, header included, so staff can find it. */
  line: number;
  ref: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  dateStr: string | null;
  startTime: string | null;
  /** Null when the file has no usable duration; the booking type's own length is used. */
  durationMinutes: number | null;
  partySize: number | null;
  typeName: string;
  status: ImportStatus | null;
  source: "WIDGET" | "ADMIN";
  channel: string | null;
  takenBy: string | null;
  notes: string | null;
  staffNotes: string | null;
  minSpendPence: number | null;
  /** Why this row won't be imported, or null if it will. */
  skip: string | null;
}

/** RFC 4180-ish: quoted fields, "" escapes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Header names each field is known by, normalised (lowercase, letters and digits only). */
const ALIASES: Record<string, string[]> = {
  ref: ["bookingref", "bookingreference", "reference", "ref", "bookingid"],
  firstName: ["clientfirstname", "firstname", "forename"],
  lastName: ["clientlastname", "lastname", "surname"],
  name: ["name", "clientname", "customername", "guestname", "fullname"],
  email: ["email", "emailaddress", "clientemail"],
  phone: ["phone", "telephone", "mobile", "phonenumber", "contactnumber"],
  requests: ["customerrequests", "requests", "specialrequests"],
  customerNotes: ["customernotes", "notes", "comments", "guestnotes"],
  internal: ["internalnotes", "staffnotes"],
  adminComments: ["admincomments"],
  guests: ["guests", "partysize", "covers", "people", "pax", "numberofguests"],
  date: ["date", "bookingdate", "visitdate"],
  time: ["time", "bookingtime", "arrivaltime", "starttime"],
  duration: ["duration", "durationminutes", "length"],
  type: ["type", "bookingtype", "area", "experience"],
  walkIn: ["walkin"],
  status: ["status", "bookingstatus"],
  lost: ["lost"],
  cancelled: ["customercancelled", "cancelled"],
  source: ["source", "channel", "bookingsource"],
  createdBy: ["createdby", "takenby"],
  minSpend: ["minimumspend", "minspend"],
  depositPaid: ["depositpaid", "depositstaken"],
  preOrderTotal: ["preordertotal"],
};

function headerIndex(header: string[]): Record<string, number> {
  const n = header.map(norm);
  const out: Record<string, number> = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    // First matching alias wins, so the most specific names are listed first.
    for (const a of names) {
      const i = n.indexOf(a);
      if (i >= 0) {
        out[field] = i;
        break;
      }
    }
  }
  // "Reference" in a Collins export is a free-text field, not the booking ref.
  if (out.ref != null && n[out.ref] === "reference" && n.includes("bookingref")) out.ref = n.indexOf("bookingref");
  return out;
}

function parseDate(v: string): string | null {
  const t = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t); // UK day/month/year
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function parseTime(v: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function money(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

const yes = (v: string | undefined) => /^(yes|y|true|1)$/i.test((v ?? "").trim());

function mapStatus(raw: string): ImportStatus | "skip" | null {
  const s = raw.trim().toLowerCase();
  if (!s) return "CONFIRMED";
  if (/^(complete|completed|confirmed|booked|accepted|seated|arrived|approved)$/.test(s)) return "CONFIRMED";
  if (/^(enquiry|enquired|pending|provisional|awaiting|unconfirmed|requested)/.test(s)) return "ENQUIRY";
  if (/(cancel|reject|declin|lost|no.?show|deleted|void)/.test(s)) return "skip";
  return null;
}

function joinNotes(parts: (string | null | undefined)[]): string | null {
  const t = parts.map((p) => (p ?? "").trim()).filter(Boolean);
  return t.length ? t.join(" / ") : null;
}

export interface ParsedImport {
  rows: ImportRow[];
  /** Plain-English problems with the file as a whole (missing columns). */
  problems: string[];
}

/**
 * @param todayStr venue-local today (YYYY-MM-DD); earlier dates are skipped,
 *   since only bookings still to come are worth bringing across.
 */
export function readBookingsCsv(text: string, todayStr: string): ParsedImport {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], problems: ["The file has no bookings in it."] };
  const [header, ...body] = table;
  const ix = headerIndex(header);
  const problems: string[] = [];
  if (ix.date == null) problems.push("No Date column.");
  if (ix.time == null) problems.push("No Time column.");
  if (ix.guests == null) problems.push("No Guests (party size) column.");
  if (ix.name == null && ix.firstName == null && ix.lastName == null) problems.push("No name column.");
  if (problems.length) return { rows: [], problems };

  const get = (r: string[], f: string) => (ix[f] != null ? (r[ix[f]] ?? "").trim() : "");

  const rows = body.map((r, i): ImportRow => {
    const ref = get(r, "ref") || null;
    const name = get(r, "name") || [get(r, "firstName"), get(r, "lastName")].filter(Boolean).join(" ");
    const dateStr = parseDate(get(r, "date"));
    const startTime = parseTime(get(r, "time"));
    const guests = Number(get(r, "guests"));
    const partySize = Number.isInteger(guests) && guests > 0 ? guests : null;
    const dur = Number(get(r, "duration"));
    const durationMinutes = Number.isFinite(dur) && dur >= 15 && dur <= 24 * 60 ? Math.round(dur) : null;
    const status = mapStatus(get(r, "status"));
    const sourceRaw = get(r, "source");
    const createdBy = get(r, "createdBy") || null;
    const online = /website|online|widget|google|instagram|facebook/i.test(sourceRaw);

    const deposit = money(get(r, "depositPaid"));
    const preOrder = money(get(r, "preOrderTotal"));
    const moneyNote = [
      deposit ? `Deposit £${(deposit / 100).toFixed(2)} paid in the old system` : null,
      preOrder ? `Pre-order total £${(preOrder / 100).toFixed(2)} in the old system` : null,
    ];

    let skip: string | null = null;
    if (status === "skip" || yes(get(r, "lost")) || yes(get(r, "cancelled"))) skip = "Cancelled or lost";
    else if (status === null) skip = `Status "${get(r, "status")}" not recognised`;
    else if (!dateStr) skip = "No valid date";
    else if (!startTime) skip = "No valid time";
    else if (!partySize) skip = "No party size";
    else if (!name) skip = "No name";
    else if (dateStr < todayStr) skip = "Date has passed";
    else if (yes(get(r, "walkIn"))) skip = "Walk-in";

    return {
      line: i + 2,
      ref,
      name: name || "(no name)",
      email: get(r, "email") || null,
      phone: get(r, "phone") || null,
      dateStr,
      startTime,
      durationMinutes,
      partySize,
      typeName: get(r, "type"),
      status: status === "CONFIRMED" || status === "ENQUIRY" ? status : null,
      source: online && !createdBy ? "WIDGET" : "ADMIN",
      channel: online ? "website" : sourceRaw ? sourceRaw.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) : null,
      takenBy: createdBy,
      notes: joinNotes([get(r, "requests"), get(r, "customerNotes")]),
      staffNotes: joinNotes([get(r, "internal"), get(r, "adminComments"), ...moneyNote, ref ? `Imported, old ref ${ref}` : "Imported"]),
      minSpendPence: money(get(r, "minSpend")),
      skip,
    };
  });
  return { rows, problems };
}

/** Loose match of a type name in the file to one of the venue's booking types. */
export function matchBookingType<T extends { id: string; name: string }>(typeName: string, types: T[]): T | null {
  const key = (s: string) => norm(s).replace(/s$/, "");
  const k = key(typeName);
  if (!k) return null;
  return types.find((t) => key(t.name) === k) ?? null;
}
