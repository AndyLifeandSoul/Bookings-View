import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { updateBookingDetails, reassignTables, sendReply, checkInBooking, checkOutBooking, undoCheckOut } from "./actions";
import { TableSelectionFields } from "./table-selection-fields";
import { naturalSortTables } from "@/lib/tables/natural-sort";

export const dynamic = "force-dynamic";

const STATUSES = ["ENQUIRY", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const [booking, tablesRaw, areas] = await Promise.all([
    prisma.booking.findFirst({
      where: { id, venueId: venue.id },
      include: {
        bookingType: { select: { name: true, tableFillMode: true } },
        bookingTables: { select: { tableId: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { staffUser: { select: { name: true } } } },
      },
    }),
    // No orderBy — see naturalSortTables' doc comment.
    prisma.table.findMany({
      where: { venueId: venue.id, active: true },
      select: { id: true, label: true, areaId: true },
    }),
    prisma.area.findMany({ where: { venueId: venue.id }, orderBy: { priority: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!booking) notFound();
  const tables = naturalSortTables(tablesRaw);

  const assignedTableIds = new Set(booking.bookingTables.map((bt) => bt.tableId));

  // Opening this page is what counts as "read" — same reasoning email
  // clients use for marking a message read on open. Fire-and-forget: a
  // failure here shouldn't block rendering the page.
  const hasUnread = booking.messages.some((m) => m.direction === "INBOUND" && !m.read);
  if (hasUnread) {
    await prisma.message.updateMany({
      where: { bookingId: booking.id, direction: "INBOUND", read: false },
      data: { read: true },
    });
  }

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

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4">
          {booking.checkedOutAt ? (
            <>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
                Checked out {booking.checkedOutAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: venue.timezone })} —
                table is free
              </span>
              <ActionForm action={undoCheckOut}>
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="venueId" value={venue.id} />
                <input type="hidden" name="venueSlug" value={venue.slug} />
                <SubmitButton
                  label="Undo check-out"
                  pendingLabel="Undoing…"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                />
              </ActionForm>
            </>
          ) : booking.checkedInAt ? (
            <>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                Checked in {booking.checkedInAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: venue.timezone })}
              </span>
              <ActionForm action={checkOutBooking}>
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="venueId" value={venue.id} />
                <input type="hidden" name="venueSlug" value={venue.slug} />
                <SubmitButton
                  label="Check out — free this table"
                  pendingLabel="Checking out…"
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                />
              </ActionForm>
            </>
          ) : (
            <ActionForm action={checkInBooking}>
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="venueId" value={venue.id} />
              <input type="hidden" name="venueSlug" value={venue.slug} />
              <SubmitButton
                label="Check in"
                pendingLabel="Checking in…"
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
              />
            </ActionForm>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-8">
          <section>
            <h2 className="text-base font-semibold text-zinc-900">Details</h2>
            <ActionForm
              key={booking.updatedAt.getTime()}
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
                    defaultValue={booking.customerEmail ?? ""}
                    className="rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-700">Phone</span>
                  <input
                    type="tel"
                    name="customerPhone"
                    defaultValue={booking.customerPhone ?? ""}
                    className="rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
                <p className="-mt-2 text-xs text-zinc-500 sm:col-span-2">At least one of email or phone is required.</p>
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
                {booking.source}. Created {booking.createdAt.toLocaleString("en-GB", { timeZone: venue.timezone })}.
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
                key={[...assignedTableIds].sort().join(",")}
                action={reassignTables}
                className="mt-3 flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5"
              >
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="venueId" value={venue.id} />
                <input type="hidden" name="venueSlug" value={venue.slug} />
                <TableSelectionFields
                  tables={tables}
                  areas={areas}
                  initialSelectedIds={[...assignedTableIds]}
                  tableFillMode={booking.bookingType.tableFillMode}
                />
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
              Emailed to/from the customer via this venue&apos;s mailbox. If no venue email is set (Settings → Venue
              Details) or Microsoft 365 isn&apos;t connected yet, replies are still logged here, just not actually sent.
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
                      <span>{message.createdAt.toLocaleString("en-GB", { timeZone: venue.timezone })}</span>
                    </div>
                    {message.subject && <div className="mt-1 font-medium text-zinc-900">{message.subject}</div>}
                    <p className="mt-1 whitespace-pre-wrap text-zinc-700">{message.body}</p>
                  </div>
                ))}
              </div>
            )}

            <ActionForm action={sendReply} className="mt-3 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="venueId" value={venue.id} />
              <input type="hidden" name="venueSlug" value={venue.slug} />
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Reply</span>
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder="Write a reply to the customer…"
                  className="rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>
              <div>
                <SubmitButton
                  label="Send reply"
                  pendingLabel="Sending…"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                />
              </div>
            </ActionForm>
          </section>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
