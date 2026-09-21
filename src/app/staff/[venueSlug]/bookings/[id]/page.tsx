import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LogIn, MessageSquare, Armchair, UtensilsCrossed, Printer, CreditCard, Clock } from "lucide-react";
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
  requestPayment,
  addPreOrderItems,
  markNoShow,
  shiftBookingRunningLate,
} from "./actions";
import { buildPreOrderLink } from "@/lib/pre-order/links";
import { groupPreOrderItems, preOrderLineUnitPricePence } from "@/lib/pre-order/group-items";
import { TableSelectionFields } from "./table-selection-fields";
import { naturalSortTables } from "@/lib/tables/natural-sort";
import type { PaymentPurpose, PaymentStatus } from "@/generated/prisma";

export const dynamic = "force-dynamic";

// NO_SHOW is deliberately left out - it has its own one-click button in the
// quick actions row below (see markNoShow), matching DesignMyNight's
// dedicated No show button rather than making staff find it in a dropdown.
const STATUSES = ["ENQUIRY", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED"] as const;

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const [booking, tablesRaw, areas, menus, categories, payments, paymentAccount] = await Promise.all([
    prisma.booking.findFirst({
      where: { id, venueId: venue.id },
      include: {
        bookingType: { select: { name: true, tableFillMode: true, preOrderPaymentRequired: true } },
        bookingTables: { select: { tableId: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { staffUser: { select: { name: true } } } },
        preOrder: {
          select: {
            notes: true,
            menuId: true,
            items: {
              select: {
                quantity: true,
                guestLabel: true,
                notes: true,
                menuItem: { select: { name: true, priceInPence: true, dietaryTags: true, category: { select: { id: true, name: true, sortOrder: true } } } },
                modifiers: {
                  orderBy: { sequence: "asc" },
                  select: { sequence: true, groupNameSnapshot: true, optionNameSnapshot: true, priceDeltaPenceSnapshot: true },
                },
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
    prisma.payment.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        purpose: true,
        status: true,
        amountInPence: true,
        currency: true,
        description: true,
        checkoutUrl: true,
        createdAt: true,
      },
    }),
    // Whether this venue even has a Dojo account wired up - both the
    // Payments section (hide/disable "Request a payment" if not) and the
    // pre-order quick-add's auto payment-request step need to know this,
    // see requestPayment/addPreOrderItems in actions.ts for what actually
    // enforces it.
    prisma.paymentAccount.findFirst({ where: { venues: { some: { id: venue.id } } }, select: { id: true } }),
  ]);
  if (!booking) notFound();

  // Every active item on the booking's pre-order menu, with its full
  // modifier customisation wizard if it has one - fetched only once we
  // know the booking's pre-order's menu, so this can't run inside the
  // Promise.all above. addPreOrderItems re-validates all of this fresh
  // server-side regardless (see its doc comment), this query is only for
  // rendering the quick-add form.
  const quickAddItems = booking.preOrder
    ? await prisma.menuItem.findMany({
        where: {
          venueId: venue.id,
          active: true,
          menuPlacements: { some: { menuId: booking.preOrder.menuId } },
        },
        orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          priceInPence: true,
          category: { select: { id: true, name: true } },
          modifierGroups: {
            orderBy: { sequence: "asc" },
            select: {
              sequence: true,
              group: {
                select: {
                  id: true,
                  name: true,
                  options: {
                    where: { active: true },
                    orderBy: { sortOrder: "asc" },
                    select: { id: true, name: true, priceDeltaPence: true },
                  },
                },
              },
            },
          },
        },
      })
    : [];
  const tables = naturalSortTables(tablesRaw);

  const assignedTableIds = new Set(booking.bookingTables.map((bt) => bt.tableId));
  const assignedTableLabels = tables.filter((t) => assignedTableIds.has(t.id)).map((t) => t.label);

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

        {/*
         * Quick actions: Running late and No show as dedicated one-click
         * buttons, per the parity review (section 14) rather than routing
         * both through the general Status dropdown below. Hidden once the
         * booking has settled into an end state, same reasoning as the
         * check-in/out card above - there's nothing left to push back or
         * mark as a no-show once it's cancelled, completed or already a
         * no-show.
         */}
        {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && booking.status !== "NO_SHOW" && (
          <Card className="mt-3 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-500">
              <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
              Running late
            </span>
            {[5, 10, 15].map((minutes) => (
              <ActionForm key={minutes} action={shiftBookingRunningLate}>
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="venueId" value={venue.id} />
                <input type="hidden" name="venueSlug" value={venue.slug} />
                <input type="hidden" name="minutes" value={minutes} />
                <SubmitButton label={`+${minutes} min`} pendingLabel="Moving…" className={buttonStyles("secondary", "sm")} />
              </ActionForm>
            ))}
            <span className="mx-1 h-5 w-px bg-zinc-200" />
            <ActionForm action={markNoShow}>
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="venueId" value={venue.id} />
              <input type="hidden" name="venueSlug" value={venue.slug} />
              <SubmitButton label="No show" pendingLabel="Marking…" className={buttonStyles("ghost", "sm")} />
            </ActionForm>
          </Card>
        )}

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
                {/*
                 * Short "currently assigned" summary above the full
                 * checkbox list, per the parity review (section 14) -
                 * staff shouldn't have to scan every table in the venue
                 * just to see what's already assigned to this booking.
                 */}
                <p className="mb-3 text-sm text-zinc-600">
                  <span className="font-medium text-zinc-900">Currently assigned: </span>
                  {assignedTableLabels.length > 0 ? assignedTableLabels.join(", ") : "No tables assigned yet."}
                </p>
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
                {booking.preOrder.notes && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                    <p className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
                      Allergies / special requests
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-amber-900">{booking.preOrder.notes}</p>
                  </div>
                )}
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
                              {item.modifiers.length > 0 && (
                                <span className="block text-xs text-zinc-500">
                                  {item.modifiers.map((m) => m.optionNameSnapshot).join(" · ")}
                                </span>
                              )}
                              {item.notes && <span className="block text-xs text-zinc-500">{item.notes}</span>}
                            </span>
                            <span className="shrink-0 text-zinc-500">
                              £{((preOrderLineUnitPricePence(item) * item.quantity) / 100).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {quickAddItems.length > 0 && (
                  <details className="rounded-md border border-zinc-200 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-zinc-700">
                      Add more items (e.g. an extra guest)
                    </summary>
                    <ActionForm action={addPreOrderItems} className="mt-3 flex flex-col gap-3">
                      <input type="hidden" name="id" value={booking.id} />
                      <input type="hidden" name="venueId" value={venue.id} />
                      <input type="hidden" name="venueSlug" value={venue.slug} />
                      <p className="text-xs text-zinc-500">
                        Set a quantity for anything the extra guest is having. For an item with customisation
                        choices, its dropdowns default to the first option - check them before saving.
                        {booking.bookingType.preOrderPaymentRequired &&
                          " This booking type is paid upfront, so adding items also raises a payment request for what's added."}
                      </p>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-zinc-700">Label (optional, e.g. &quot;Guest 5&quot;)</span>
                        <input
                          type="text"
                          name="guestLabel"
                          className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="flex flex-col divide-y divide-zinc-100">
                        {quickAddItems.map((item) => (
                          <div key={item.id} className="flex flex-col gap-2 py-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span>
                                {item.name}
                                <span className="ml-2 text-xs text-zinc-500">£{(item.priceInPence / 100).toFixed(2)}</span>
                              </span>
                              <input
                                type="number"
                                name={`qty__${item.id}`}
                                min={0}
                                defaultValue={0}
                                className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                              />
                            </div>
                            {item.modifierGroups.length > 0 && (
                              <div className="ml-2 flex flex-wrap gap-2">
                                {item.modifierGroups.map((attached) => (
                                  <label key={attached.group.id} className="flex flex-col gap-0.5">
                                    <span className="text-xs text-zinc-500">{attached.group.name}</span>
                                    <select
                                      name={`mod__${item.id}__${attached.group.id}`}
                                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                                    >
                                      {attached.group.options.map((option) => (
                                        <option key={option.id} value={option.id}>
                                          {option.name}
                                          {option.priceDeltaPence > 0 ? ` (+£${(option.priceDeltaPence / 100).toFixed(2)})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div>
                        <SubmitButton label="Add items" pendingLabel="Adding…" className={buttonStyles("primary", "sm")} />
                      </div>
                    </ActionForm>
                  </details>
                )}
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
              <CreditCard className="h-4 w-4 text-zinc-400" strokeWidth={2.25} />
              Payments
            </h2>
            {payments.length === 0 ? (
              <Card className="mt-3">
                <p className="text-sm text-zinc-500">No payments or payment requests on this booking yet.</p>
              </Card>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {payments.map((payment) => (
                  <Card key={payment.id} padded={false} className="flex flex-col gap-2 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-zinc-900">
                        £{(payment.amountInPence / 100).toFixed(2)} · {purposeLabel(payment.purpose)}
                      </span>
                      <span className={statusBadgeClassName(payment.status)}>{payment.status.replace("_", " ")}</span>
                    </div>
                    {payment.description && <p className="text-xs text-zinc-500">{payment.description}</p>}
                    <p className="text-xs text-zinc-400">
                      {payment.createdAt.toLocaleString("en-GB", { timeZone: venue.timezone })}
                    </p>
                    {payment.checkoutUrl && payment.status === "CREATED" && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="text"
                          readOnly
                          value={payment.checkoutUrl}
                          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-700"
                        />
                        <CopyLinkButton link={payment.checkoutUrl} />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            <Card className="mt-3">
              {paymentAccount ? (
                <ActionForm action={requestPayment} className="flex flex-col gap-4">
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="venueId" value={venue.id} />
                  <input type="hidden" name="venueSlug" value={venue.slug} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-zinc-700">Amount (£)</span>
                      <input
                        type="number"
                        name="amountPounds"
                        min="0.01"
                        step="0.01"
                        required
                        className="rounded-md border border-zinc-300 px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-zinc-700">Purpose</span>
                      <select name="purpose" defaultValue="BALANCE" className="rounded-md border border-zinc-300 px-3 py-2">
                        <option value="DEPOSIT">Deposit</option>
                        <option value="BALANCE">Balance / top-up</option>
                        <option value="FULL">Full payment</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-zinc-700">Description (optional, shown to the customer)</span>
                    <input
                      type="text"
                      name="description"
                      placeholder="e.g. Outstanding deposit"
                      className="rounded-md border border-zinc-300 px-3 py-2"
                    />
                  </label>
                  <div>
                    <SubmitButton
                      label="Request a payment"
                      pendingLabel="Creating…"
                      className={buttonStyles("primary", "md")}
                    />
                  </div>
                </ActionForm>
              ) : (
                <p className="text-sm text-zinc-500">
                  {venue.name} has no Dojo payment account assigned yet, see Admin, so payment requests can&apos;t be
                  raised from here.
                </p>
              )}
            </Card>
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

function purposeLabel(purpose: PaymentPurpose): string {
  switch (purpose) {
    case "DEPOSIT":
      return "Deposit";
    case "BALANCE":
      return "Balance / top-up";
    case "FULL":
      return "Full payment";
  }
}

function statusBadgeClassName(status: PaymentStatus): string {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  switch (status) {
    case "CAPTURED":
      return `${base} bg-[var(--success-soft)] text-[var(--success-soft-text)]`;
    case "CREATED":
    case "AUTHORIZED":
      return `${base} bg-amber-50 text-amber-800`;
    case "REFUNDED":
    case "REVERSED":
    case "CANCELLED":
    case "FAILED":
      return `${base} bg-zinc-100 text-zinc-600`;
  }
}
