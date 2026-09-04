import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LogIn, MessageSquare, Armchair, UtensilsCrossed, Printer } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  updateBookingDetails,
  reassignTables,
  sendReply,
  checkInBooking,
  checkOutBooking,
  undoCheckOut,
  requestPreOrder,
  cancelPreOrderInvite,
} from "./actions";
import { buildPreOrderLink } from "@/lib/pre-order/links";
import { groupPreOrderItems } from "@/lib/pre-order/group-items";
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

  const [booking, tablesRaw, areas, menus, categories] = await Promise.all([
    prisma.booking.findFirst({
      where: { id, venueId: venue.id },
      include: {
        bookingType: { select: { name: true, tableFillMode: true } },
        bookingTables: { select: { tableId: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { staffUser: { select: { name: true } } } },
        preOrder: {
          select: {
            items: {
              select: {
                quantity: true,
                guestLabel: true,
                notes: true,
                menuItem: { select: { name: true, priceInPence: true, dietaryTags: true, category: { select: { id: true, name: true, sortOrder: true } } } },
              },
            },
          },
        },
        preOrderInvite: { select: { token: true, menuId: true, categoryIds: true, submittedAt: true } },
      },
    }),
    // No orderBy, see naturalSortTables' doc comment.
    prisma.table.findMany({
      where: { venueId: venue.id, active: true },
      select: { id: true, label: true, areaId: true },
    }),
    prisma.area.findMany({ where: { venueId: venue.id }, orderBy: { priority: "asc" }, select: { id: true, name: true } }),
    prisma.menu.findMany({ where: { venueId: venue.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.menuCategory.findMany({
      where: { venueId: venue.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!booking) notFound();
  const tables = naturalSortTables(tablesRaw);

  const assignedTableIds = new Set(booking.bookingTables.map((bt) => bt.tableId));

  // Opening this page is what counts as "read", same reasoning email
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
    <div className="flex flex-1 flex-col px-4 py-8 sm:py-12">
      <div className="animate-in mx-auto w-full max-w-3xl">
        <Link
          href={`/staff/${venue.slug}/diary?date=${booking.date.toISOString().slice(0, 10)}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-[var(--accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
          Back to {venue.name}
        </Link>

        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{booking.customerName}</h1>
            <p className="text-sm text-zinc-500">
              {booking.bookingRef ?? booking.id} · {booking.bookingType.name} ·{" "}
              {formatDate(booking.date)}, {booking.startTime}–{booking.endTime}
            </p>
          </div>
        </div>

        <Card className="mt-4 flex flex-wrap items-center gap-3">
          {booking.checkedOutAt ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
                Checked out {booking.checkedOutAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: venue.timezone })},
                table is free
              </span>
              <ActionForm action={undoCheckOut}>
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="venueId" value={venue.id} />
                <input type="hidden" name="venueSlug" value={venue.slug} />
                <SubmitButton label="Undo check-out" pendingLabel="Undoing…" className={buttonStyles("secondary", "sm")} />
              </ActionForm>
            </>
          ) : booking.checkedInAt ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-3 py-1 text-sm font-medium text-[var(--success-soft-text)]">
                <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
                Checked in {booking.checkedInAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: venue.timezone })}
              </span>
              <ActionForm action={checkOutBooking}>
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="venueId" value={venue.id} />
                <input type="hidden" name="venueSlug" value={venue.slug} />
                <SubmitButton
                  label="Check out, free this table"
                  pendingLabel="Checking out…"
                  className={buttonStyles("primary", "sm")}
                />
              </ActionForm>
            </>
          ) : (
            <ActionForm action={checkInBooking}>
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="venueId" value={venue.id} />
              <input type="hidden" name="venueSlug" value={venue.slug} />
              <SubmitButton label="Check in" pendingLabel="Checking in…" className={buttonStyles("primary", "sm")} />
            </ActionForm>
          )}
        </Card>

        <div className="mt-8 flex flex-col gap-8">
          <section>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Details</h2>
            <Card className="mt-3">
              <ActionForm key={booking.updatedAt.getTime()} action={updateBookingDetails} className="flex flex-col gap-4">
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
                  <SubmitButton label="Save changes" pendingLabel="Saving…" className={buttonStyles("primary", "md")} />
                </div>
              </ActionForm>
            </Card>
          </section>

          <section>
            <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-zinc-900">
              <Armchair className="h-4 w-4 text-zinc-400" strokeWidth={2.25} />
              Tables
            </h2>
            {tables.length === 0 ? (
              <Card className="mt-3">
                <p className="text-sm text-zinc-500">No tables set up for this venue yet, see Tables &amp; Areas in Admin.</p>
              </Card>
            ) : (
              <Card className="mt-3">
                <ActionForm key={[...assignedTableIds].sort().join(",")} action={reassignTables} className="flex flex-col gap-4">
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
                      className={buttonStyles("primary", "md")}
                    />
                  </div>
                </ActionForm>
              </Card>
            )}
          </section>

          <section>
            <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-zinc-900">
              <UtensilsCrossed className="h-4 w-4 text-zinc-400" strokeWidth={2.25} />
              Pre-order
            </h2>
            {booking.preOrder ? (
              <Card className="mt-3 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">Submitted by the customer.</p>
                  <Link
                    href={`/staff/${venue.slug}/bookings/${booking.id}/pre-order/print`}
                    target="_blank"
                    className={buttonStyles("secondary", "sm")}
                  >
                    <Printer className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Print for kitchen
                  </Link>
                </div>
                <div className="flex flex-col gap-4">
                  {groupPreOrderItems(booking.preOrder.items).map((group) => (
                    <div key={group.category?.id ?? "uncategorised"}>
                      {group.category && (
                        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{group.category.name}</h3>
                      )}
                      <ul className="mt-1 flex flex-col divide-y divide-zinc-100">
                        {group.items.map((item, i) => (
                          <li key={i} className="flex items-start justify-between gap-4 py-1.5 text-sm">
                            <span>
                              <span className="font-medium text-zinc-900">
                                {item.quantity} x {item.menuItem.name}
                              </span>
                              {item.guestLabel && <span className="text-zinc-500"> ({item.guestLabel})</span>}
                              {item.notes && <span className="block text-xs text-zinc-500">{item.notes}</span>}
                            </span>
                            <span className="shrink-0 text-zinc-500">
                              £{((item.menuItem.priceInPence * item.quantity) / 100).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            ) : menus.length === 0 ? (
              <Card className="mt-3">
                <p className="text-sm text-zinc-500">
                  This venue has no pre-order menus set up yet, see Menus in Admin.
                </p>
              </Card>
            ) : booking.preOrderInvite ? (
              <Card className="mt-3 flex flex-col gap-3">
                <p className="text-sm text-zinc-700">
                  A pre-order link has been generated for this booking. Send it to the customer however you normally
                  reach them (email, text) - there is no automated send yet.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={buildPreOrderLink(booking.preOrderInvite.token)}
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                  />
                  <CopyLinkButton link={buildPreOrderLink(booking.preOrderInvite.token)} />
                </div>
                <ActionForm action={cancelPreOrderInvite}>
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="venueId" value={venue.id} />
                  <input type="hidden" name="venueSlug" value={venue.slug} />
                  <SubmitButton
                    label="Cancel, pick a different menu"
                    pendingLabel="Cancelling…"
                    className={buttonStyles("ghost", "sm")}
                  />
                </ActionForm>
              </Card>
            ) : (
              <Card className="mt-3">
                <ActionForm action={requestPreOrder} className="flex flex-col gap-4">
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="venueId" value={venue.id} />
                  <input type="hidden" name="venueSlug" value={venue.slug} />
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-zinc-700">Menu</span>
                    <select
                      name="menuId"
                      required
                      defaultValue=""
                      className="w-64 rounded-md border border-zinc-300 px-3 py-2"
                    >
                      <option value="" disabled>
                        Choose a menu…
                      </option>
                      {menus.map((menu) => (
                        <option key={menu.id} value={menu.id}>
                          {menu.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {categories.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-zinc-700">Which sections should they see?</span>
                      <p className="text-xs text-zinc-500">
                        Items with no category (e.g. a simple one-course menu) always show regardless of what is
                        picked here.
                      </p>
                      <div className="flex flex-col gap-1.5 pt-1">
                        {categories.map((category) => (
                          <label key={category.id} className="flex items-center gap-2 text-sm text-zinc-700">
                            <input
                              type="checkbox"
                              name="categoryIds"
                              value={category.id}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                            {category.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <SubmitButton
                      label="Generate pre-order link"
                      pendingLabel="Generating…"
                      className={buttonStyles("primary", "md")}
                    />
                  </div>
                </ActionForm>
              </Card>
            )}
          </section>

          <section>
            <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-zinc-900">
              <MessageSquare className="h-4 w-4 text-zinc-400" strokeWidth={2.25} />
              Messages
            </h2>
            {booking.messages.length === 0 ? (
              <Card className="mt-3">
                <p className="text-sm text-zinc-500">No messages for this booking yet.</p>
              </Card>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {booking.messages.map((message) => (
                  <Card key={message.id} padded={false} className="p-3 text-sm">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>
                        {message.direction === "OUTBOUND" ? `Sent${message.staffUser ? ` by ${message.staffUser.name}` : ""}` : "Received"}
                      </span>
                      <span>{message.createdAt.toLocaleString("en-GB", { timeZone: venue.timezone })}</span>
                    </div>
                    {message.subject && <div className="mt-1 font-medium text-zinc-900">{message.subject}</div>}
                    <p className="mt-1 whitespace-pre-wrap text-zinc-700">{message.body}</p>
                  </Card>
                ))}
              </div>
            )}

            <Card className="mt-3">
              <ActionForm action={sendReply} className="flex flex-col gap-3">
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
                  <SubmitButton label="Send reply" pendingLabel="Sending…" className={buttonStyles("primary", "md")} />
                </div>
              </ActionForm>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
