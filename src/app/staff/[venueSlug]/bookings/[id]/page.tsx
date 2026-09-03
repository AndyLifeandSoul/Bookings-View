import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { updateBookingDetails, reassignTables } from "./actions";

export const dynamic = "force-dynamic";

const STATUSES = ["ENQUIRY", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const [booking, tables] = await Promise.all([
    prisma.booking.findFirst({
      where: { id, venueId: venue.id },
      include: {
        bookingType: { select: { name: true } },
        bookingTables: { select: { tableId: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { staffUser: { select: { name: true } } } },
      },
    }),
    prisma.table.findMany({
      where: { venueId: venue.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);
  if (!booking) notFound();

  const assignedTableIds = new Set(booking.bookingTables.map((bt) => bt.tableId));

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link href={`/staff/${venue.slug}`} className="text-sm text-zinc-500 underline hover:text-zinc-900">
          ← Back to {venue.name}
        </Link>

        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{booking.customerName}</h1>
            <p className="text-sm text-zinc-500">
              {booking.bookingRef ?? booking.id} · {booking.bookingType.name} ·{" "}
              {formatDate(booking.date)}, {booking.startTime}–{booking.endTime}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-8">
          <section>
            <h2 className="text-base font-semibold text-zinc-900">Details</h2>
            <ActionForm
              action={updateBookingDetails}
              className="mt-3 flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5"
            >
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="venueId" value={venue.id} />
              <input type="hidden" name="venueSlug" value={venue.slug} />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">Customer name</span>
                  <input
                    type="text"
                    name="customerName"
                    required
                    defaultValue={booking.customerName}
                    className="rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">Email</span>
                  <input
                    type="email"
                    name="customerEmail"
                    required
                    defaultValue={booking.customerEmail}
                    className="rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">Phone (optional)</span>
                  <input
                    type="tel"
                    name="customerPhone"
                    defaultValue={booking.customerPhone ?? ""}
                    className="rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">Party size</span>
                  <input
                    type="number"
                    name="partySize"
                    min={1}
                    required
                    defaultValue={booking.partySize}
                    className="rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Status</span>
                <select
                  name="status"
                  defaultValue={booking.status}
                  className="w-56 rounded-md border border-zinc-300 px-3 py-2"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Notes (optional)</span>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={booking.notes ?? ""}
                  className="rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>

              <div className="text-xs text-zinc-400">
                {booking.marketingOptIn ? "Opted in to marketing." : "Not opted in to marketing."} Source:{" "}
                {booking.source}. Created {booking.createdAt.toLocaleString("en-GB")}.
              </div>

              <div>
                <SubmitButton
                  label="Save changes"
                  pendingLabel="Saving…"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                />
              </div>
            </ActionForm>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900">Tables</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Which table(s) this booking is seated at. Reassigning here is checked against every other active
              booking at this venue for the same date and time.
            </p>
            {tables.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                No tables set up for this venue yet — see Tables &amp; Areas in Admin.
              </p>
            ) : (
              <ActionForm
                action={reassignTables}
                className="mt-3 flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5"
              >
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="venueId" value={venue.id} />
                <input type="hidden" name="venueSlug" value={venue.slug} />
                <div className="flex flex-wrap gap-3">
                  {tables.map((table) => (
                    <label
                      key={table.id}
                      className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="tableIds"
                        value={table.id}
                        defaultChecked={assignedTableIds.has(table.id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      {table.label}
                    </label>
                  ))}
                </div>
                <div>
                  <SubmitButton
                    label="Save table assignment"
                    pendingLabel="Saving…"
                    className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  />
                </div>
              </ActionForm>
            )}
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900">Messages</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Sending isn&apos;t connected yet (needs an email provider decision), so this is history only.
            </p>
            {booking.messages.length === 0 ? (
              <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                No messages for this booking yet.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {booking.messages.map((message) => (
                  <div key={message.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>
                        {message.direction === "OUTBOUND" ? `Sent${message.staffUser ? ` by ${message.staffUser.name}` : ""}` : "Received"}
                      </span>
                      <span>{message.createdAt.toLocaleString("en-GB")}</span>
                    </div>
                    {message.subject && <div className="mt-1 font-medium text-zinc-900">{message.subject}</div>}
                    <p className="mt-1 whitespace-pre-wrap text-zinc-700">{message.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
