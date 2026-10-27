/**
 * Turns a period's bookings and payments into the numbers on the Reports
 * page. Pure: no database, so the page can stay a thin query wrapper.
 */

export interface ReportBooking {
  date: Date;
  startTime: string;
  partySize: number;
  status: string;
  source: string;
  channel: string | null;
  occasion: string | null;
  createdAt: Date;
  cancelledBy: string | null;
  discountPence: number;
  bookingTypeName: string;
  addOns: { nameSnapshot: string; quantity: number; unitPricePence: number }[];
}

export interface ReportPayment {
  status: string;
  purpose: string;
  amountInPence: number;
  refundedAmountInPence: number;
}

export interface Count {
  label: string;
  value: number;
  /** Secondary number shown beside it, e.g. covers beside bookings. */
  extra?: number;
}

export interface Report {
  bookings: number;
  covers: number;
  averageParty: number;
  noShows: number;
  noShowRate: number;
  cancellations: number;
  cancellationRate: number;
  cancelledByGuest: number;
  enquiries: number;
  onlineShare: number;
  bySource: Count[];
  byType: Count[];
  byWeekday: Count[];
  byHour: Count[];
  leadTime: Count[];
  occasions: Count[];
  extras: Count[];
  money: {
    taken: number;
    refunded: number;
    net: number;
    noShowFees: number;
    discounts: number;
    extras: number;
  };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SOURCE_LABELS: Record<string, string> = {
  website: "Your website",
  direct: "Booking page",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  email: "Email newsletter",
  qr: "QR code",
  bookmein: "bookmein.now",
  staff: "Staff",
  phone: "Phone",
};

/** Where a booking came from: the tagged channel, else how it was made. */
export function sourceOf(b: Pick<ReportBooking, "source" | "channel">): string {
  if (b.channel === "walk_in") return "Walk-in";
  if (b.source === "PHONE") return "Phone";
  if (b.source === "ADMIN") return "Staff";
  const ch = (b.channel ?? "direct").toLowerCase();
  return SOURCE_LABELS[ch] ?? ch.charAt(0).toUpperCase() + ch.slice(1);
}

function tally(entries: Iterable<[string, number, number?]>, order?: string[]): Count[] {
  const map = new Map<string, { value: number; extra: number }>();
  for (const [label, value, extra] of entries) {
    const cur = map.get(label) ?? { value: 0, extra: 0 };
    cur.value += value;
    cur.extra += extra ?? 0;
    map.set(label, cur);
  }
  const rows = [...map.entries()].map(([label, v]) => ({ label, value: v.value, extra: v.extra || undefined }));
  if (order) return order.map((label) => rows.find((r) => r.label === label) ?? { label, value: 0 });
  return rows.sort((a, b) => b.value - a.value);
}

function leadBucket(days: number): string {
  if (days <= 0) return "Same day";
  if (days <= 2) return "1 to 2 days";
  if (days <= 7) return "3 to 7 days";
  if (days <= 30) return "1 to 4 weeks";
  return "Over a month";
}
const LEAD_ORDER = ["Same day", "1 to 2 days", "3 to 7 days", "1 to 4 weeks", "Over a month"];

export function summarise(all: ReportBooking[], payments: ReportPayment[]): Report {
  const enquiries = all.filter((b) => b.status === "ENQUIRY").length;
  const cancelled = all.filter((b) => b.status === "CANCELLED");
  // Unpaid checkouts that were never completed aren't real cancellations.
  const realCancelled = cancelled.filter((b) => b.cancelledBy !== "System");
  const kept = all.filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED" || b.status === "NO_SHOW");
  const noShows = kept.filter((b) => b.status === "NO_SHOW").length;
  const covers = kept.reduce((s, b) => s + b.partySize, 0);
  const made = kept.length + realCancelled.length;
  const online = kept.filter((b) => b.source === "WIDGET").length;

  const extrasRows = kept.flatMap((b) => b.addOns);
  const taken = payments.filter((p) => p.status === "CAPTURED" || p.status === "REFUNDED").reduce((s, p) => s + p.amountInPence, 0);
  const refunded = payments.reduce((s, p) => s + p.refundedAmountInPence, 0);

  return {
    bookings: kept.length,
    covers,
    averageParty: kept.length ? covers / kept.length : 0,
    noShows,
    noShowRate: kept.length ? noShows / kept.length : 0,
    cancellations: realCancelled.length,
    cancellationRate: made ? realCancelled.length / made : 0,
    cancelledByGuest: realCancelled.filter((b) => b.cancelledBy === "Guest").length,
    enquiries,
    onlineShare: kept.length ? online / kept.length : 0,
    bySource: tally(kept.map((b) => [sourceOf(b), 1, b.partySize])),
    byType: tally(kept.map((b) => [b.bookingTypeName, 1, b.partySize])),
    byWeekday: tally(
      kept.map((b) => [WEEKDAYS[(b.date.getUTCDay() + 6) % 7], b.partySize]),
      WEEKDAYS,
    ),
    byHour: tally(kept.map((b) => [`${b.startTime.slice(0, 2)}:00`, b.partySize])).sort((a, b) => a.label.localeCompare(b.label)),
    leadTime: tally(
      kept.map((b) => {
        const madeDay = Date.UTC(b.createdAt.getUTCFullYear(), b.createdAt.getUTCMonth(), b.createdAt.getUTCDate());
        return [leadBucket(Math.round((b.date.getTime() - madeDay) / 86_400_000)), 1];
      }),
      LEAD_ORDER,
    ),
    occasions: tally(kept.filter((b) => b.occasion).map((b) => [b.occasion as string, 1])),
    extras: tally(extrasRows.map((a) => [a.nameSnapshot, a.quantity, a.quantity * a.unitPricePence])),
    money: {
      taken,
      refunded,
      net: taken - refunded,
      noShowFees: payments.filter((p) => p.purpose === "NO_SHOW_FEE" && p.status === "CAPTURED").reduce((s, p) => s + p.amountInPence, 0),
      discounts: kept.reduce((s, b) => s + b.discountPence, 0),
      extras: extrasRows.reduce((s, a) => s + a.quantity * a.unitPricePence, 0),
    },
  };
}
