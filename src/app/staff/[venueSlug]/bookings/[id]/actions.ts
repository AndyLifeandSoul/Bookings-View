"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { findTableConflicts } from "@/lib/staff/table-conflicts";
import { sendMailAs } from "@/lib/email/graph-client";
import type { ActionResult } from "@/components/action-form";
import type { BookingStatus, PaymentPurpose } from "@/generated/prisma";
import { getPaymentProviderForAccount } from "@/lib/payments/get-provider";
import type { PaymentAccountCode } from "@/lib/payments/types";
import { getCustomerAppUrl } from "@/lib/pre-order/links";


const STATUSES: BookingStatus[] = ["ENQUIRY", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"];

/** The two real-world Dojo merchant accounts currently wired up, see PaymentAccountCode in lib/payments/types.ts. */
const PAYMENT_ACCOUNT_CODES: PaymentAccountCode[] = ["DV8", "LIFE_AND_SOUL"];

const PAYMENT_PURPOSES: PaymentPurpose[] = ["DEPOSIT", "BALANCE", "FULL"];

/**
 * Same "trust nothing but the session" shape as requireAdminSession, but for
 * staff - every action here is its own reachable POST endpoint, and a STAFF
 * session must never be able to touch a booking outside its own venue
 * (checked again per-action below, not just by whatever page rendered the
 * form) while OWNER/MANAGER can touch any venue's booking.
 */
async function requireVenueAccess(
  venueId: string,
): Promise<{ staffUserId: string } | { error: string }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Not signed in." };
  if (session.role === "STAFF" && session.venueId !== venueId) {
    return { error: "That booking doesn't belong to your venue." };
  }
  return { staffUserId: session.staffUserId };
}

export async function updateBookingDetails(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  const customerName = String(formData.get("customerName") ?? "").trim();
  if (!customerName) return { error: "Customer name is required." };
  const customerEmailRaw = String(formData.get("customerEmail") ?? "").trim();
  if (customerEmailRaw && !customerEmailRaw.includes("@")) return { error: "Email doesn't look valid." };
  const customerEmail = customerEmailRaw || null;
  const customerPhone = String(formData.get("customerPhone") ?? "").trim() || null;
  if (!customerEmail && !customerPhone) return { error: "Enter at least one of email or phone." };
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const partySizeRaw = Number(formData.get("partySize"));
  if (!Number.isFinite(partySizeRaw) || partySizeRaw < 1) {
    return { error: "Party size must be at least 1." };
  }
  const partySize = Math.trunc(partySizeRaw);

  const statusRaw = String(formData.get("status") ?? "");
  if (!STATUSES.includes(statusRaw as BookingStatus)) return { error: `Invalid status: "${statusRaw}"` };
  const status = statusRaw as BookingStatus;

  await prisma.booking.update({
    where: { id },
    data: { customerName, customerEmail, customerPhone, notes, partySize, status },
  });

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}`);
}

export async function reassignTables(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({
    where: { id, venueId },
    select: { id: true, date: true, startTime: true, endTime: true },
  });
  if (!booking) return { error: "Booking not found for this venue." };

  const tableIds = formData.getAll("tableIds").map(String).filter(Boolean);
  if (tableIds.length > 0) {
    const validTables = await prisma.table.count({ where: { id: { in: tableIds }, venueId } });
    if (validTables !== tableIds.length) return { error: "One or more selected tables don't belong to this venue." };

    const conflicts = await findTableConflicts({
      venueId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      tableIds,
      excludeBookingId: id,
    });
    if (conflicts.length > 0) {
      const names = [...new Set(conflicts.map((c) => `${c.tableLabel} (${c.customerName}, ${c.startTime}-${c.endTime})`))];
      return { error: `Can't assign, already booked at this time: ${names.join(", ")}.` };
    }
  }

  await prisma.$transaction([
    prisma.bookingTable.deleteMany({ where: { bookingId: id } }),
    ...(tableIds.length > 0
      ? [prisma.bookingTable.createMany({ data: tableIds.map((tableId) => ({ bookingId: id, tableId })) })]
      : []),
  ]);

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
}

/**
 * Sends a reply as the venue's mailbox (Venue.email) via Graph and logs it
 * as an OUTBOUND Message either way - even when Graph isn't configured or
 * the send fails, so staff always have a record of what they meant to say,
 * with the send failure surfaced as the action's error rather than losing
 * the message text. read defaults to true for OUTBOUND (see Message.read's
 * doc comment), so this never shows up as something needing attention.
 */
export async function sendReply(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message can't be empty." };

  const booking = await prisma.booking.findFirst({
    where: { id, venueId },
    select: { id: true, customerEmail: true, bookingRef: true, venue: { select: { name: true, email: true } } },
  });
  if (!booking) return { error: "Booking not found for this venue." };

  const session = await getCurrentStaffSession();
  const subject = `Re: your booking${booking.bookingRef ? ` ${booking.bookingRef}` : ""} at ${booking.venue.name}`;

  let sendError: string | null = null;
  if (!booking.venue.email) {
    sendError = "This venue has no email address set (Settings → Venue Details), logged only, not sent.";
  } else if (!booking.customerEmail) {
    sendError = "This booking has no customer email on file, logged only, not sent.";
  } else {
    const result = await sendMailAs(booking.venue.email, booking.customerEmail, subject, body);
    if (!result.ok) sendError = `Logged, but sending failed: ${result.error}`;
  }

  await prisma.message.create({
    data: {
      bookingId: id,
      direction: "OUTBOUND",
      subject,
      body,
      staffUserId: session?.staffUserId,
    },
  });

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  if (sendError) return { error: sendError };
}

/** Marks every unread inbound message on this booking read - called when staff open/action a booking from the Messages tab. */
export async function markMessagesRead(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  await prisma.message.updateMany({
    where: { bookingId: id, direction: "INBOUND", read: false, booking: { venueId } },
    data: { read: true },
  });

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}/messages`);
}

/**
 * Marks a booking as arrived. Doesn't affect table-conflict/availability
 * checks at all (see Booking.checkedInAt's doc comment) - purely a record
 * of "they're here", so staff can see who's actually in at a glance.
 */
export async function checkInBooking(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  await prisma.booking.update({ where: { id }, data: { checkedInAt: new Date() } });
  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}/diary`);
}

/**
 * Marks a booking's table as cleared - from this point on it's excluded
 * from every table-conflict/availability check regardless of how much of
 * its formally booked window remains, so it's immediately bookable again.
 * See Booking.checkedOutAt's doc comment.
 */
export async function checkOutBooking(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  // checkedInAt is deliberately left untouched (not cleared) - checking out
  // still implies they were checked in at some point, and "when did they
  // arrive" stays a useful fact after the table's freed up. Status moves to
  // COMPLETED at the same time (Andy's spec) so a checked-out booking reads
  // as finished everywhere status is shown (list view, All Bookings), not
  // just on the diary via checkedOutAt.
  await prisma.booking.update({ where: { id }, data: { checkedOutAt: new Date(), status: "COMPLETED" } });
  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}/diary`);
  revalidatePath(`/staff/${venueSlug}/list`);
  revalidatePath("/admin/bookings");
}

/**
 * Undoes an accidental check-out, the table goes back to being occupied by
 * this booking for conflict-checking purposes. Also reverts the automatic
 * COMPLETED status checkOutBooking sets, back to CONFIRMED, symmetric with
 * that action: checking out only ever happens from an active booking, so
 * undoing it restores that active state rather than leaving it stuck on
 * COMPLETED.
 */
export async function undoCheckOut(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  await prisma.booking.update({ where: { id }, data: { checkedOutAt: null, status: "CONFIRMED" } });
  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
  revalidatePath(`/staff/${venueSlug}/diary`);
  revalidatePath(`/staff/${venueSlug}/list`);
  revalidatePath("/admin/bookings");
}

/**
 * Staff picking a menu + which of the venue's categories the customer
 * should see, per booking. Re-issuing (this booking already has an
 * unsubmitted invite) replaces it outright rather than editing in place -
 * a fresh token is simplest, and there's no link already sent out yet to
 * worry about invalidating since delivery is manual (staff copy/paste, see
 * Andy's decision - no automated email for now).
 *
 * categoryIds intentionally isn't required to be non-empty here: a venue
 * with no MenuCategory rows at all (Rumba's flat pizza-choice menu, see
 * MenuCategory's doc comment) has nothing to pick, and its items - having
 * no categoryId - show up on the portal regardless of this list. It's only
 * DV8-style categorised menus where an empty selection would actually hide
 * everything, and the UI for those always renders at least one checkbox to
 * pick from.
 */
export async function requestPreOrder(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({
    where: { id, venueId },
    select: { id: true, preOrder: { select: { id: true } } },
  });
  if (!booking) return { error: "Booking not found for this venue." };
  if (booking.preOrder) return { error: "This booking already has a submitted pre-order." };

  const menuId = String(formData.get("menuId") ?? "");
  if (!menuId) return { error: "Choose a menu." };
  const menu = await prisma.menu.findFirst({ where: { id: menuId, venueId }, select: { id: true } });
  if (!menu) return { error: "That menu doesn't belong to this venue." };

  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
  if (categoryIds.length > 0) {
    const validCount = await prisma.menuCategory.count({ where: { id: { in: categoryIds }, venueId } });
    if (validCount !== categoryIds.length) return { error: "One or more selected categories don't belong to this venue." };
  }

  const token = crypto.randomBytes(32).toString("base64url");

  await prisma.$transaction([
    // A booking can only ever have one invite (@unique bookingId) - clear
    // out an existing unsubmitted one first rather than relying on upsert,
    // since the token/categoryIds are being regenerated wholesale, not
    // merged.
    prisma.preOrderInvite.deleteMany({ where: { bookingId: id } }),
    prisma.preOrderInvite.create({ data: { bookingId: id, menuId, categoryIds, token } }),
  ]);

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
}

/** Lets staff start over - pick a different menu/categories, or abandon the request entirely. Never touches a submitted invite (the transaction that marks it submitted and the one that would delete it can't race in a way that matters here, but the where-clause guards it regardless). */
export async function cancelPreOrderInvite(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({ where: { id, venueId }, select: { id: true } });
  if (!booking) return { error: "Booking not found for this venue." };

  await prisma.preOrderInvite.deleteMany({ where: { bookingId: id, submittedAt: null } });
  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
}

/**
 * Staff-raised ad-hoc payment request against a booking: a Dojo hosted
 * checkout link for an arbitrary amount, for cases the automatic
 * deposit/pre-order-payment flow in lifeandsoul-bookings doesn't cover -
 * Andy's own examples: chasing an outstanding deposit, or any other
 * one-off charge. Creates the Dojo payment intent directly from this app
 * rather than round-tripping through lifeandsoul-bookings - see
 * lib/payments/*.ts's mirrored-file headers: the webhook handler is
 * generic across whichever app created the Payment row, so this is safe.
 * The resulting checkoutUrl is persisted on the Payment row itself
 * (ActionResult can't carry a success payload back to the client, see
 * action-form.tsx) so it can be shown/copied again from the Payments
 * section on this page after it refreshes.
 */
export async function requestPayment(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({
    where: { id, venueId },
    select: {
      id: true,
      venueId: true,
      date: true,
      customerEmail: true,
      venue: { select: { name: true, paymentAccount: { select: { id: true, code: true } } } },
    },
  });
  if (!booking) return { error: "Booking not found for this venue." };
  if (!booking.venue.paymentAccount) {
    return { error: `${booking.venue.name} has no Dojo payment account assigned - ask an admin to set one in Admin before requesting payment.` };
  }
  if (!PAYMENT_ACCOUNT_CODES.includes(booking.venue.paymentAccount.code as PaymentAccountCode)) {
    return { error: `${booking.venue.name}'s payment account code "${booking.venue.paymentAccount.code}" isn't recognised.` };
  }

  const amountPounds = Number(String(formData.get("amountPounds") ?? "").trim());
  if (!Number.isFinite(amountPounds) || amountPounds <= 0) {
    return { error: "Enter an amount greater than £0." };
  }
  const amountInPence = Math.round(amountPounds * 100);

  const purposeRaw = String(formData.get("purpose") ?? "");
  if (!PAYMENT_PURPOSES.includes(purposeRaw as PaymentPurpose)) return { error: "Choose what this payment is for." };
  const purpose = purposeRaw as PaymentPurpose;

  const description = String(formData.get("description") ?? "").trim() || null;

  const provider = getPaymentProviderForAccount(booking.venue.paymentAccount.code as PaymentAccountCode);
  const customerAppUrl = getCustomerAppUrl();

  try {
    const intent = await provider.createPaymentIntent({
      amountInPence,
      currency: "GBP",
      captureMode: "AUTO",
      reference: booking.id,
      description: description ?? `Payment request for ${booking.venue.name} booking`,
      customerEmail: booking.customerEmail ?? undefined,
      returnUrl: `${customerAppUrl}/payment-received?booking=${encodeURIComponent(venueSlug)}`,
      cancelUrl: `${customerAppUrl}/payment-cancelled?booking=${encodeURIComponent(venueSlug)}`,
    });

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        venueId: booking.venueId,
        bookingDate: booking.date,
        paymentAccountId: booking.venue.paymentAccount.id,
        purpose,
        captureMode: "AUTO",
        status: "CREATED",
        amountInPence,
        currency: "GBP",
        providerPaymentIntentId: intent.providerPaymentIntentId,
        checkoutUrl: intent.checkoutUrl ?? null,
        description,
      },
    });
  } catch (err) {
    return { error: `Could not create the payment request: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
}

/**
 * Quick-add: staff add extra pre-order items to a booking that already has
 * a submitted PreOrder - Andy's example: a table booked and paid for 4,
 * called back to add a 5th person's dishes. First-pass scope limitation
 * (disclosed to Andy): only items with no modifier customisation wizard
 * (MenuItemModifierGroup rows) can be quick-added here - full modifier
 * selection needs the same validate-and-price logic the customer kiosk
 * uses (lifeandsoul-bookings' validateAndPricePreOrder), which doesn't
 * exist in this app. The booking details page only ever offers
 * modifier-free items as options, but this re-checks server-side
 * regardless, never trusting an id/quantity typed into a form on its own.
 *
 * When the booking type requires payment up front for pre-orders
 * (BookingType.preOrderPaymentRequired, e.g. Rumba's bottomless brunch),
 * adding items also raises a BALANCE payment request for exactly the
 * price of what's being added - not a reconciliation against everything
 * already paid, just the cost of this addition, which is all Andy's own
 * example actually needs (charge for the 1 extra person, not re-total the
 * whole booking). For pay-on-the-day types (DV8), items are added with no
 * payment step, same as the original pre-order.
 *
 * If the items are added but the payment request can't be created (no
 * payment account configured, or the Dojo call fails), the items are kept
 * - a hungry table shouldn't lose its order over a payment API hiccup -
 * and the error tells staff to raise it manually via "Request a payment"
 * for the same amount instead.
 */
export async function addPreOrderItems(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const access = await requireVenueAccess(venueId);
  if ("error" in access) return access;

  const booking = await prisma.booking.findFirst({
    where: { id, venueId },
    select: {
      id: true,
      venueId: true,
      date: true,
      customerEmail: true,
      bookingType: { select: { preOrderPaymentRequired: true } },
      venue: { select: { name: true, paymentAccount: { select: { id: true, code: true } } } },
      preOrder: { select: { id: true, menuId: true } },
    },
  });
  if (!booking) return { error: "Booking not found for this venue." };
  if (!booking.preOrder) return { error: "This booking doesn't have a submitted pre-order yet." };
  const preOrderId = booking.preOrder.id;
  const menuId = booking.preOrder.menuId;

  const guestLabel = String(formData.get("guestLabel") ?? "").trim() || null;

  const qtyEntries: { menuItemId: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty__")) continue;
    const quantity = Math.trunc(Number(value));
    if (Number.isFinite(quantity) && quantity > 0) {
      qtyEntries.push({ menuItemId: key.slice("qty__".length), quantity });
    }
  }
  if (qtyEntries.length === 0) return { error: "Enter a quantity for at least one item." };

  // Re-fetch the eligible (modifier-free, on this pre-order's menu) items
  // server-side - see this action's doc comment on why the form's own ids
  // aren't trusted on their own.
  const eligibleItems = await prisma.menuItem.findMany({
    where: {
      id: { in: qtyEntries.map((e) => e.menuItemId) },
      venueId,
      active: true,
      menuPlacements: { some: { menuId } },
      modifierGroups: { none: {} },
    },
    select: { id: true, priceInPence: true },
  });
  const eligibleById = new Map(eligibleItems.map((item) => [item.id, item]));

  const lines = qtyEntries
    .map((e) => ({ ...e, item: eligibleById.get(e.menuItemId) }))
    .filter((e): e is { menuItemId: string; quantity: number; item: { id: string; priceInPence: number } } => e.item !== undefined);
  if (lines.length === 0) {
    return {
      error:
        "None of the selected items could be added (they may no longer be on this menu, or need customisation this quick-add doesn't support).",
    };
  }

  const addedAmountInPence = lines.reduce((sum, l) => sum + l.item.priceInPence * l.quantity, 0);

  await prisma.preOrderItem.createMany({
    data: lines.map((l) => ({
      preOrderId,
      menuItemId: l.menuItemId,
      quantity: l.quantity,
      guestLabel,
    })),
  });

  if (!booking.bookingType.preOrderPaymentRequired) {
    revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
    return;
  }

  const addedAmountDisplay = `£${(addedAmountInPence / 100).toFixed(2)}`;

  if (!booking.venue.paymentAccount || !PAYMENT_ACCOUNT_CODES.includes(booking.venue.paymentAccount.code as PaymentAccountCode)) {
    revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
    return {
      error: `Items were added, but ${booking.venue.name} has no valid Dojo payment account, so no payment request could be raised automatically. Use "Request a payment" below for ${addedAmountDisplay}.`,
    };
  }

  const provider = getPaymentProviderForAccount(booking.venue.paymentAccount.code as PaymentAccountCode);
  const customerAppUrl = getCustomerAppUrl();
  const description = `Pre-order top-up${guestLabel ? ` for ${guestLabel}` : ""}`;

  try {
    const intent = await provider.createPaymentIntent({
      amountInPence: addedAmountInPence,
      currency: "GBP",
      captureMode: "AUTO",
      reference: booking.id,
      description,
      customerEmail: booking.customerEmail ?? undefined,
      returnUrl: `${customerAppUrl}/payment-received?booking=${encodeURIComponent(venueSlug)}`,
      cancelUrl: `${customerAppUrl}/payment-cancelled?booking=${encodeURIComponent(venueSlug)}`,
    });

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        venueId: booking.venueId,
        bookingDate: booking.date,
        paymentAccountId: booking.venue.paymentAccount.id,
        purpose: "BALANCE",
        captureMode: "AUTO",
        status: "CREATED",
        amountInPence: addedAmountInPence,
        currency: "GBP",
        providerPaymentIntentId: intent.providerPaymentIntentId,
        checkoutUrl: intent.checkoutUrl ?? null,
        description,
      },
    });
  } catch (err) {
    revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
    return {
      error: `Items were added, but the payment request could not be created (${err instanceof Error ? err.message : String(err)}). Use "Request a payment" below for ${addedAmountDisplay}.`,
    };
  }

  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
}
