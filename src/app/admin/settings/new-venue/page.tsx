import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { getCustomerAppUrl } from "@/lib/pre-order/links";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createVenue } from "./actions";
import { VenueNameFields } from "./venue-name-fields";

export const dynamic = "force-dynamic";

const input = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

/** Add a venue: the essentials only, then the Go live checklist takes over. */
export default async function NewVenuePage() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER") redirect("/admin/settings");
  const base = getCustomerAppUrl().replace(/^https?:\/\//, "");

  return (
    <div className="animate-in mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <Link href="/admin/settings" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ChevronLeft className="h-4 w-4" /> Settings
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">Add a venue</h1>
      <p className="mt-1 text-sm text-zinc-500">
        The basics to get it started. Online booking stays off until you switch it on, and the Go live checklist walks you through the rest: hours, tables, booking types and payments.
      </p>
      <Card className="mt-6">
        <ActionForm action={createVenue} className="flex flex-col gap-5">
          <VenueNameFields bookingBase={base} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800">Address</span>
            <textarea name="address" rows={2} className={input} placeholder="22 High Street, Sandbach, CW11 1AX" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Phone</span>
              <input name="phone" type="tel" className={input} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Email</span>
              <input name="email" type="email" className={input} placeholder="bookings@venue.co.uk" />
              <span className="text-xs text-zinc-500">Guest emails are sent from this address.</span>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Booking reference code</span>
              <input name="bookingCode" className={`${input} w-32 uppercase`} placeholder="FAH" />
              <span className="text-xs text-zinc-500">2 to 8 letters at the start of each booking reference.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Company name</span>
              <input name="legalEntityName" className={input} placeholder="Fox and Hound Ltd" />
              <span className="text-xs text-zinc-500">Shown on the payment page and policies. Must match its Dojo account.</span>
            </label>
          </div>
          <div>
            <SubmitButton label="Add venue" pendingLabel="Adding..." className={buttonStyles("primary", "md")} />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
