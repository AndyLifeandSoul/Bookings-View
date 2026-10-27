"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import type { ActionResult } from "@/components/action-form";
import { logBookingEvent } from "@/lib/bookings/events";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking-confirmation";
import { createPaymentIntentViaCustomerApp } from "@/lib/payments/remote-intent";
import { PAYMENT_ACCOUNT_CODES, type PaymentAccountCode } from "@/lib/payments/types";
import { getCustomerAppUrl } from "@/lib/pre-order/links";
import { sendVenueMail } from "@/lib/email/send";
import { renderVenueEmail } from "@/lib/email/templates";
import { logOutboundEmail } from "@/lib/email/log-message";
import { resolveVenueLogoUrl } from "@/lib/venues/logo";
import { ENQUIRY_STAGES } from "@/lib/bookings/enquiry-stages";


async function access(venueId: string): Promise<{ name: string } | { error: string }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "Not signed in." };
  if (session.role === "STAFF" && session.venueId !== venueId) return { error: "That enquiry doesn't belong to your venue." };
  return { name: session.name };
}

function revalidate(venueSlug: string, id: string) {
  revalidatePath(`/staff/${venueSlug}/enquiries`);
  revalidatePath(`/staff/${venueSlug}/bookings/${id}`);
}

/** Saves the pipeline fields on an enquiry: stage, owner, follow-up date, budget, notes. */
export async function updateEnquiryPipeline(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const who = await access(venueId);
  if ("error" in who) return who;
  const before = await prisma.booking.findFirst({ where: { id, venueId }, select: { enquiryStage: true, assignedToId: true, followUpDate: true } });
  if (!before) return { error: "Enquiry not found." };

  const stageRaw = String(formData.get("enquiryStage") ?? "NEW");
  const stage = ENQUIRY_STAGES.some((s) => s.key === stageRaw) ? stageRaw : "NEW";
  const assignedToId = String(formData.get("assignedToId") ?? "") || null;
  if (assignedToId) {
    const ok = await prisma.staffUser.count({ where: { id: assignedToId, active: true, OR: [{ venueId }, { venueId: null }] } });
    if (!ok) return { error: "Pick someone from this venue's team." };
  }
  const followRaw = String(formData.get("followUpDate") ?? "");
  const followUpDate = /^\d{4}-\d{2}-\d{2}$/.test(followRaw) ? new Date(`${followRaw}T00:00:00.000Z`) : null;
  const budgetRaw = String(formData.get("budgetPounds") ?? "").trim();
  const budgetPence = budgetRaw && Number(budgetRaw) > 0 ? Math.round(Number(budgetRaw) * 100) : null;
  const proposalNote = String(formData.get("proposalNote") ?? "").trim() || null;

  await prisma.booking.update({ where: { id }, data: { enquiryStage: stage, assignedToId, followUpDate, budgetPence, proposalNote } });
  const changes: string[] = [];
  if (stage !== (before.enquiryStage ?? "NEW")) changes.push(`stage set to ${ENQUIRY_STAGES.find((s) => s.key === stage)?.label.toLowerCase()}`);
  if (assignedToId !== before.assignedToId) changes.push(assignedToId ? "owner changed" : "owner removed");
  if ((followUpDate?.getTime() ?? 0) !== (before.followUpDate?.getTime() ?? 0)) changes.push(followUpDate ? `follow up on ${followRaw}` : "follow-up cleared");
  await logBookingEvent({ bookingId: id, actor: who.name, kind: "enquiry", detail: changes.length ? `Enquiry ${changes.join(", ")}` : "Enquiry details saved" });
  revalidate(venueSlug, id);
}

/** Quick stage change from the board. */
export async function setEnquiryStage(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const who = await access(venueId);
  if ("error" in who) return who;
  if (!ENQUIRY_STAGES.some((s) => s.key === stage)) return { error: "Unknown stage." };
  const updated = await prisma.booking.updateMany({ where: { id, venueId, status: "ENQUIRY" }, data: { enquiryStage: stage } });
  if (updated.count !== 1) return { error: "Enquiry not found." };
  await logBookingEvent({ bookingId: id, actor: who.name, kind: "enquiry", detail: `Enquiry moved to ${ENQUIRY_STAGES.find((s) => s.key === stage)?.label.toLowerCase()}` });
  revalidate(venueSlug, id);
}

/** Turns an enquiry into a confirmed booking and emails the guest. Tables are assigned on the booking screen. */
export async function confirmEnquiry(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const who = await access(venueId);
  if ("error" in who) return who;
  const booking = await prisma.booking.findFirst({
    where: { id, venueId, status: "ENQUIRY" },
    select: {
      id: true,
      bookingRef: true,
      customerName: true,
      customerEmail: true,
      date: true,
      startTime: true,
      partySize: true,
      manageToken: true,
      bookingType: { select: { name: true } },
      venue: { select: { id: true, slug: true, name: true, email: true, logoUrl: true, logoImageType: true, brandColorHex: true, address: true, phone: true } },
    },
  });
  if (!booking) return { error: "That enquiry has already been confirmed or closed." };
  await prisma.booking.update({ where: { id }, data: { status: "CONFIRMED", enquiryStage: "WON" } });
  await logBookingEvent({ bookingId: id, actor: who.name, kind: "confirmed", detail: "Enquiry confirmed as a booking" });
  if (formData.get("notify") !== "off" && booking.customerEmail) {
    await sendBookingConfirmationEmail({
      venue: booking.venue,
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      date: booking.date,
      startTime: booking.startTime,
      partySize: booking.partySize,
      bookingTypeName: booking.bookingType.name,
      isEnquiry: false,
      manageToken: booking.manageToken,
    });
  }
  revalidate(venueSlug, id);
}

/** Closes an enquiry that won't go ahead, with a reason for reporting. */
export async function markEnquiryLost(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const who = await access(venueId);
  if ("error" in who) return who;
  const reason = String(formData.get("lostReason") ?? "").trim() || "No reason given";
  const updated = await prisma.booking.updateMany({
    where: { id, venueId, status: "ENQUIRY" },
    data: { status: "CANCELLED", enquiryStage: "LOST", lostReason: reason, cancelledAt: new Date(), cancelledBy: who.name, cancellationReason: reason },
  });
  if (updated.count !== 1) return { error: "Enquiry not found." };
  await logBookingEvent({ bookingId: id, actor: who.name, kind: "lost", detail: `Enquiry closed as lost: ${reason}` });
  revalidate(venueSlug, id);
}

/**
 * Sends the guest a proposal: the note, the agreed details and one payment
 * link per staged payment (for example a deposit now and the balance two
 * weeks before). Each stage becomes a Dojo payment link through the
 * customer app. When the first stage is paid the enquiry confirms itself
 * (see applyPaymentStatus in the customer app).
 */
export async function sendProposal(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const venueSlug = String(formData.get("venueSlug") ?? "");
  const who = await access(venueId);
  if ("error" in who) return who;

  const booking = await prisma.booking.findFirst({
    where: { id, venueId },
    select: {
      id: true,
      venueId: true,
      date: true,
      startTime: true,
      partySize: true,
      bookingRef: true,
      customerName: true,
      customerEmail: true,
      proposalNote: true,
      paymentStages: { where: { paymentId: null } },
      bookingType: { select: { name: true } },
      venue: { select: { slug: true, name: true, email: true, logoUrl: true, logoImageType: true, brandColorHex: true, address: true, phone: true, paymentAccount: { select: { id: true, code: true } } } },
    },
  });
  if (!booking) return { error: "Enquiry not found." };
  if (!booking.customerEmail) return { error: "Add the guest's email first, the proposal goes by email." };

  const labels = formData.getAll("stageLabel").map(String);
  const amounts = formData.getAll("stageAmount").map(String);
  const dues = formData.getAll("stageDue").map(String);
  const stages = labels
    .map((label, i) => ({ label: label.trim(), amountPence: Math.round(Number(amounts[i] || 0) * 100), due: /^\d{4}-\d{2}-\d{2}$/.test(dues[i] ?? "") ? dues[i] : null }))
    .filter((s) => s.label && s.amountPence > 0);

  if (stages.length > 0 && (!booking.venue.paymentAccount || !PAYMENT_ACCOUNT_CODES.includes(booking.venue.paymentAccount.code as PaymentAccountCode))) {
    return { error: `${booking.venue.name} has no payment account set up, so payment links can't be sent.` };
  }

  const links: { label: string; amountPence: number; due: string | null; url: string | null }[] = [];
  try {
    for (const [i, stage] of stages.entries()) {
      const intent = await createPaymentIntentViaCustomerApp({
        accountCode: booking.venue.paymentAccount!.code as PaymentAccountCode,
        amountInPence: stage.amountPence,
        reference: `${booking.bookingRef ?? booking.id} ${stage.label}`.slice(0, 60),
        description: `${stage.label} for ${booking.venue.name}`,
        customerEmail: booking.customerEmail,
        returnUrl: `${getCustomerAppUrl()}/payment-received?booking=${encodeURIComponent(venueSlug)}`,
        cancelUrl: `${getCustomerAppUrl()}/payment-cancelled?booking=${encodeURIComponent(venueSlug)}`,
      });
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          venueId: booking.venueId,
          bookingDate: booking.date,
          paymentAccountId: booking.venue.paymentAccount!.id,
          purpose: i === 0 ? "DEPOSIT" : "BALANCE",
          status: "CREATED",
          amountInPence: stage.amountPence,
          providerPaymentIntentId: intent.providerPaymentIntentId,
          checkoutUrl: intent.checkoutUrl,
          description: stage.label,
        },
      });
      await prisma.bookingPaymentStage.create({
        data: { bookingId: booking.id, label: stage.label, amountPence: stage.amountPence, dueDate: stage.due ? new Date(`${stage.due}T00:00:00.000Z`) : null, paymentId: payment.id, sortOrder: i },
      });
      links.push({ ...stage, url: intent.checkoutUrl });
    }
  } catch (err) {
    return { error: `Couldn't create the payment links: ${err instanceof Error ? err.message : String(err)}` };
  }

  const dateLabel = booking.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const rendered = renderVenueEmail(
    { name: booking.venue.name, logoUrl: resolveVenueLogoUrl(booking.venue), brandColorHex: booking.venue.brandColorHex, address: booking.venue.address, phone: booking.venue.phone, email: booking.venue.email },
    {
      heading: "Your proposal",
      intro: [`Hi ${booking.customerName},`, ...(booking.proposalNote ? booking.proposalNote.split(/\n\s*\n/) : [`Here are the details for your ${booking.bookingType.name.toLowerCase()} at ${booking.venue.name}.`])],
      details: [
        { label: "Date", value: dateLabel },
        { label: "Time", value: booking.startTime },
        { label: "Guests", value: String(booking.partySize) },
        ...links.map((l) => ({ label: `${l.label}${l.due ? ` (due ${l.due})` : ""}`, value: `£${(l.amountPence / 100).toFixed(2)}` })),
      ],
      ...(links[0]?.url ? { button: { label: `Pay ${links[0].label.toLowerCase()} to confirm`, url: links[0].url } } : {}),
      links: links.slice(1).filter((l) => l.url).map((l) => ({ label: `Pay ${l.label.toLowerCase()}`, url: l.url! })),
      outro: [links.length > 0 ? "Your booking is confirmed as soon as the first payment is made." : "Reply to this email to confirm, or with any questions."],
    },
  );
  const subject = `Your proposal from ${booking.venue.name}${booking.bookingRef ? ` (${booking.bookingRef})` : ""}`;
  const sent = booking.venue.email
    ? await sendVenueMail({ mailbox: booking.venue.email, to: booking.customerEmail, subject, text: rendered.text, html: rendered.html })
    : { ok: false as const, error: "This venue has no email address set." };
  if (sent.ok) await logOutboundEmail(booking.id, subject, rendered.text);

  await prisma.booking.update({ where: { id }, data: { enquiryStage: "PROPOSAL_SENT", proposalSentAt: new Date() } });
  await logBookingEvent({ bookingId: id, actor: who.name, kind: "proposal", detail: `Proposal sent${links.length ? ` with ${links.length} payment ${links.length === 1 ? "link" : "links"}` : ""}` });
  revalidate(venueSlug, id);
  if (!sent.ok) return { error: `Payment links were created but the email didn't send: ${"error" in sent ? sent.error : "unknown error"}` };
}
