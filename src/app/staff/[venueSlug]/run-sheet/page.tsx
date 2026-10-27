import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { guestFlagsFor } from "@/lib/admin/guest-flags";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { occasionLabel } from "@/lib/bookings/occasions";
import { PrintButton } from "../bookings/[id]/pre-order/print/print-button";
import { buttonStyles } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * The night's run sheet: one printable page for the door and the floor with
 * every booking in arrival order, its tables, occasion, allergies, notes,
 * pre-order and money state, plus totals and an allergy list up top. The
 * staff top bar is hidden when printing (see top-bar.tsx).
 */
export default async function RunSheetPage({ params, searchParams }: { params: Promise<{ venueSlug: string }>; searchParams: Promise<{ date?: string }> }) {
  const { venueSlug } = await params;
  const { date: dateParam } = await searchParams;
  const { venue } = await requireStaffVenue(venueSlug);
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const bookings = await prisma.booking.findMany({
    where: { venueId: venue.id, date: new Date(`${dateStr}T00:00:00.000Z`), status: { in: ["CONFIRMED", "ENQUIRY", "PENDING_PAYMENT", "COMPLETED"] } },
    orderBy: [{ startTime: "asc" }, { customerName: "asc" }],
    select: {
      id: true,
      bookingRef: true,
      startTime: true,
      endTime: true,
      partySize: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      occasion: true,
      dietaryNotes: true,
      notes: true,
      staffNotes: true,
      minSpendPence: true,
      cardHoldSetupIntentId: true,
      bookingType: { select: { name: true } },
      bookingTables: { select: { table: { select: { label: true } } } },
      payments: { select: { status: true, amountInPence: true, refundedAmountInPence: true } },
      preOrder: { select: { items: { select: { quantity: true } } } },
      addOns: { select: { nameSnapshot: true, quantity: true } },
    },
  });

  // Allergies and tags kept on the guest's record count too, not just this booking's.
  const flags = await guestFlagsFor(bookings);
  for (const b of bookings) {
    const f = flags.get(b.id);
    if (f?.allergies && !b.dietaryNotes) b.dietaryNotes = f.allergies;
  }
  const live = bookings.filter((b) => b.status !== "ENQUIRY");
  const covers = live.reduce((s, b) => s + b.partySize, 0);
  const byType = new Map<string, { bookings: number; covers: number }>();
  for (const b of live) {
    const t = byType.get(b.bookingType.name) ?? { bookings: 0, covers: 0 };
    byType.set(b.bookingType.name, { bookings: t.bookings + 1, covers: t.covers + b.partySize });
  }
  const allergies = bookings.filter((b) => b.dietaryNotes);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-zinc-900 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/staff/${venue.slug}/diary?date=${dateStr}`} className="text-sm text-zinc-500 hover:text-[var(--accent)]">
          Back to the diary
        </Link>
        <div className="flex gap-2">
          <Link href={`/staff/${venue.slug}/run-sheet?date=${addDays(dateStr, -1)}`} className={buttonStyles("secondary", "sm")}>
            Previous day
          </Link>
          <Link href={`/staff/${venue.slug}/run-sheet?date=${addDays(dateStr, 1)}`} className={buttonStyles("secondary", "sm")}>
            Next day
          </Link>
          <PrintButton />
        </div>
      </div>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-zinc-900 pb-3 print:mt-0">
        <div>
          <h1 className="text-2xl font-bold">{venue.name} run sheet</h1>
          <p className="text-sm">{formatDate(dateStr)}</p>
        </div>
        <div className="flex gap-6 text-right text-sm">
          <div>
            <div className="text-2xl font-bold tabular-nums">{live.length}</div>
            bookings
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{covers}</div>
            covers
          </div>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {[...byType.entries()].map(([name, t]) => (
          <span key={name}>
            <strong>{name}</strong>: {t.bookings} ({t.covers} covers)
          </span>
        ))}
        {bookings.length - live.length > 0 && <span>Open enquiries: {bookings.length - live.length}</span>}
      </div>

      {allergies.length > 0 && (
        <section className="mt-4 rounded-md border-2 border-zinc-900 p-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">Allergies and dietary needs</h2>
          <ul className="mt-1 text-sm">
            {allergies.map((b) => (
              <li key={b.id}>
                {b.startTime} {b.customerName} ({b.bookingTables.map((t) => t.table.label).join("+") || "no table"}): {b.dietaryNotes}
              </li>
            ))}
          </ul>
        </section>
      )}

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-zinc-900 text-left text-xs uppercase tracking-wide">
            <th className="py-1.5 pr-2">Time</th>
            <th className="py-1.5 pr-2">Name</th>
            <th className="py-1.5 pr-2 text-right">Guests</th>
            <th className="py-1.5 pr-2">Table</th>
            <th className="py-1.5 pr-2">Booking</th>
            <th className="py-1.5 pr-2">Notes</th>
            <th className="py-1.5 pr-2">Money</th>
            <th className="py-1.5 print:w-10">Arr.</th>
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-zinc-500">
                No bookings for this day.
              </td>
            </tr>
          )}
          {bookings.map((b) => {
            const paid = b.payments.filter((p) => p.status === "CAPTURED" || p.status === "REFUNDED").reduce((s, p) => s + p.amountInPence - p.refundedAmountInPence, 0);
            const preOrderItems = b.preOrder?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
            const notes = [
              b.occasion ? occasionLabel(b.occasion) : null,
              b.notes,
              b.staffNotes ? `Staff: ${b.staffNotes}` : null,
              b.addOns.length > 0 ? `Extras: ${b.addOns.map((a) => `${a.quantity > 1 ? `${a.quantity}x ` : ""}${a.nameSnapshot}`).join(", ")}` : null,
              preOrderItems > 0 ? `Pre-order: ${preOrderItems} items` : null,
            ].filter(Boolean);
            const money = [
              paid > 0 ? `Paid £${(paid / 100).toFixed(2)}` : null,
              b.status === "PENDING_PAYMENT" ? "UNPAID" : null,
              b.minSpendPence ? `Min spend £${(b.minSpendPence / 100).toFixed(0)}` : null,
              b.cardHoldSetupIntentId ? "Card held" : null,
            ].filter(Boolean);
            return (
              <tr key={b.id} className="break-inside-avoid border-b border-zinc-300 align-top">
                <td className="py-1.5 pr-2 font-semibold tabular-nums">{b.startTime}</td>
                <td className="py-1.5 pr-2">
                  <span className="font-semibold">{b.customerName}</span>
                  {flags.get(b.id)?.tags.length ? <span className="ml-1 text-xs font-semibold uppercase">[{flags.get(b.id)!.tags.join(", ")}]</span> : null}
                  {b.status === "ENQUIRY" && <span className="ml-1 text-xs">(enquiry)</span>}
                  {b.customerPhone && <div className="text-xs text-zinc-600">{b.customerPhone}</div>}
                </td>
                <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{b.partySize}</td>
                <td className="py-1.5 pr-2">{b.bookingTables.map((t) => t.table.label).join(" + ") || "-"}</td>
                <td className="py-1.5 pr-2">
                  {b.bookingType.name}
                  <div className="text-xs text-zinc-600">until {b.endTime}</div>
                </td>
                <td className="py-1.5 pr-2">
                  {b.dietaryNotes && <div className="font-semibold">Allergy: {b.dietaryNotes}</div>}
                  {notes.map((n, i) => (
                    <div key={i}>{n}</div>
                  ))}
                </td>
                <td className="py-1.5 pr-2 text-xs">{money.join(", ")}</td>
                <td className="py-1.5">
                  <span className="inline-block h-4 w-4 border border-zinc-900" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
