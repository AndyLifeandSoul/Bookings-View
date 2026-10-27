import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateSelect } from "@/components/date-select";
import { ENQUIRY_STAGES } from "@/lib/bookings/enquiry-stages";
import { updateEnquiryPipeline, confirmEnquiry, markEnquiryLost, sendProposal } from "../../enquiries/actions";
import { ProposalStages } from "./proposal-stages";

/**
 * The enquiry tools on the booking screen while it's still an enquiry:
 * pipeline fields, a proposal with staged payment links, confirm as a
 * booking, or close as lost with a reason.
 */
export function EnquiryPanel({
  booking,
  venue,
  team,
}: {
  booking: {
    id: string;
    enquiryStage: string | null;
    assignedToId: string | null;
    followUpDate: Date | null;
    budgetPence: number | null;
    proposalNote: string | null;
    proposalSentAt: Date | null;
    customerEmail: string | null;
    paymentStages: { id: string; label: string; amountPence: number; dueDate: Date | null; paidAt: Date | null }[];
  };
  venue: { id: string; slug: string; timezone: string };
  team: { id: string; name: string }[];
}) {
  const hidden = (
    <>
      <input type="hidden" name="id" value={booking.id} />
      <input type="hidden" name="venueId" value={venue.id} />
      <input type="hidden" name="venueSlug" value={venue.slug} />
    </>
  );
  return (
    <section>
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Enquiry</h2>
      <Card className="mt-3 flex flex-col gap-5">
        <ActionForm action={updateEnquiryPipeline} resetOnSuccess={false} className="flex flex-col gap-4">
          {hidden}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Stage</span>
              <select name="enquiryStage" defaultValue={booking.enquiryStage ?? "NEW"} className="rounded-md border border-zinc-300 bg-white px-3 py-2">
                {ENQUIRY_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Owner</span>
              <select name="assignedToId" defaultValue={booking.assignedToId ?? ""} className="rounded-md border border-zinc-300 bg-white px-3 py-2">
                <option value="">Nobody yet</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Follow up on</span>
              <DateSelect name="followUpDate" defaultValue={booking.followUpDate?.toISOString().slice(0, 10)} label="Follow-up date" />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Rough budget (£)</span>
              <input
                type="number"
                name="budgetPounds"
                min={0}
                step="any"
                defaultValue={booking.budgetPence != null ? (booking.budgetPence / 100).toString() : ""}
                className="w-40 rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Proposal message</span>
            <textarea
              name="proposalNote"
              rows={4}
              defaultValue={booking.proposalNote ?? ""}
              placeholder="What's included: the space, food, drinks package, timings. This goes at the top of the proposal email."
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <div>
            <SubmitButton label="Save" pendingLabel="Saving..." className={buttonStyles("secondary", "md")} />
          </div>
        </ActionForm>

        {booking.paymentStages.length > 0 && (
          <div className="border-t border-zinc-100 pt-4">
            <p className="text-sm font-medium text-zinc-900">Payment schedule</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {booking.paymentStages.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span>
                    {s.label}
                    {s.dueDate ? ` (due ${s.dueDate.toISOString().slice(0, 10)})` : ""}
                  </span>
                  <span className={s.paidAt ? "font-medium text-emerald-700" : "text-zinc-600"}>
                    £{(s.amountPence / 100).toFixed(2)} {s.paidAt ? "paid" : "unpaid"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-zinc-100 pt-4">
          <p className="text-sm font-medium text-zinc-900">{booking.proposalSentAt ? "Send another proposal" : "Send a proposal"}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Emails the proposal message with a payment link for each stage. Paying the first one confirms the booking automatically. Save the message above first.
          </p>
          <ActionForm action={sendProposal} className="mt-3 flex flex-col gap-3">
            {hidden}
            <ProposalStages />
            <div>
              <SubmitButton
                label="Send proposal"
                pendingLabel="Sending..."
                className={buttonStyles("primary", "md")}
              />
              {!booking.customerEmail && <span className="ml-3 text-xs text-red-700">Add the guest&apos;s email first.</span>}
            </div>
          </ActionForm>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
          <ActionForm action={confirmEnquiry}>
            {hidden}
            <SubmitButton label="Confirm as a booking" pendingLabel="Confirming..." className={buttonStyles("primary", "md")} />
          </ActionForm>
          <ActionForm action={markEnquiryLost} className="flex flex-wrap items-end gap-2">
            {hidden}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Not going ahead? Why</span>
              <select name="lostReason" className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm">
                <option>Went elsewhere</option>
                <option>Too expensive</option>
                <option>Date not available</option>
                <option>No reply</option>
                <option>Changed plans</option>
                <option>Other</option>
              </select>
            </label>
            <SubmitButton label="Close as lost" pendingLabel="Closing..." className={buttonStyles("ghost", "md")} />
          </ActionForm>
        </div>
      </Card>
    </section>
  );
}
