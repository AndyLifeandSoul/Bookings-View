import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { getCustomerAppUrl } from "@/lib/pre-order/links";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { updateVenueDetails } from "./actions";
import { VenueLookFields } from "./venue-look-fields";

export const dynamic = "force-dynamic";

const input = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 [box-shadow:var(--shadow-sm)]">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

function Toggle({ name, label, detail, defaultChecked }: { name: string; label: string; detail?: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-2.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-zinc-300" />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        {detail && <span className="text-xs text-zinc-500">{detail}</span>}
      </span>
    </label>
  );
}

/**
 * Everything about the venue itself: the online booking switch and rules
 * that apply across every booking type, contact details, how the booking
 * page looks, who gets told about online bookings, and tracking IDs.
 */
export default async function VenueDetailsPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue: venueRef, session } = await requireAdminVenue(venueSlug);
  const isOwner = session.role === "OWNER";

  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: venueRef.id },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      address: true,
      phone: true,
      email: true,
      legalEntityName: true,
      paymentAccount: { select: { id: true, code: true, name: true } },
      bookingCode: true,
      maxArrivalsPer30Min: true,
      maxCoversPer30Min: true,
      logoUrl: true,
      logoImageType: true,
      headerImageType: true,
      headerPosX: true,
      headerPosY: true,
      headerZoom: true,
      headerDim: true,
      brandColorHex: true,
      googleReviewUrl: true,
      ga4MeasurementId: true,
      metaPixelId: true,
      notificationEmail: true,
      notifyOnNewBooking: true,
      notifyOnCancellation: true,
      notifyOnEnquiry: true,
      dailyDigest: true,
      refundCutoffHours: true,
      onlineBookingLive: true,
      updatedAt: true,
    },
  });
  const v = venue.updatedAt.getTime();
  const logoSrc = venue.logoImageType ? `/api/venue-logo/${venue.slug}?v=${v}` : venue.logoUrl;
  const headerSrc = venue.headerImageType ? `/api/venue-header/${venue.slug}?v=${v}` : null;
  const bookingPage = `${getCustomerAppUrl()}/book/${venue.slug}`;
  const accounts = isOwner ? await prisma.paymentAccount.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Venue details</h2>
        <a href={bookingPage} target="_blank" rel="noreferrer" className={buttonStyles("secondary", "sm")}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
          View booking page
        </a>
      </div>

      <ActionForm action={updateVenueDetails} resetOnSuccess={false} className="flex flex-col gap-5" encType="multipart/form-data">
        <input type="hidden" name="venueId" value={venue.id} />

        <Block title="Online booking">
          <label
            className={`flex items-start gap-3 rounded-xl border p-4 ${venue.onlineBookingLive ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}
          >
            <input type="checkbox" name="onlineBookingLive" defaultChecked={venue.onlineBookingLive} className="mt-0.5 h-4 w-4 rounded border-zinc-300" />
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-900">Taking bookings online</span>
              <span className="text-xs text-zinc-600">
                Untick to pause the booking page, for example while you set up or during a refit. Guests see your phone number and email instead. Staff can still add bookings in the diary.
              </span>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Free cancellation up to" hint="Guests cancelling earlier get an automatic refund. Later, deposits are kept. Shown in your refund policy.">
              <span className="flex items-center gap-2">
                <input type="number" name="refundCutoffHours" min={0} max={720} required defaultValue={venue.refundCutoffHours} className={`${input} w-24`} />
                <span className="text-sm text-zinc-500">hours before</span>
              </span>
            </Field>
            <Field label="Booking reference code" hint="2 to 8 letters or numbers at the start of each reference, like BBL-1042.">
              <input type="text" name="bookingCode" defaultValue={venue.bookingCode ?? ""} placeholder="BBL" className={`${input} w-32 uppercase`} />
            </Field>
            <Field label="Most bookings arriving together" hint="Across every booking type, in any 30 minutes. Blank for no limit.">
              <input type="number" name="maxArrivalsPer30Min" min={1} defaultValue={venue.maxArrivalsPer30Min ?? ""} placeholder="No limit" className={`${input} w-28`} />
            </Field>
            <Field label="Most guests arriving together" hint="Covers across every booking type in any 30 minutes, to pace the kitchen. Blank for no limit.">
              <input type="number" name="maxCoversPer30Min" min={1} defaultValue={venue.maxCoversPer30Min ?? ""} placeholder="No limit" className={`${input} w-28`} />
            </Field>
          </div>
        </Block>

        <Block title="Contact details" hint="Shown at the bottom of the booking page and in every guest email.">
          <Field label="Venue name">
            <input type="text" name="name" required defaultValue={venue.name} className={input} />
          </Field>
          <Field label="Address">
            <textarea name="address" rows={2} defaultValue={venue.address ?? ""} className={input} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input type="tel" name="phone" defaultValue={venue.phone ?? ""} className={input} />
            </Field>
            <Field label="Email" hint="Guest emails are sent from and replied to this address.">
              <input type="email" name="email" defaultValue={venue.email ?? ""} placeholder="bookings@venuename.co.uk" className={input} />
            </Field>
          </div>
          {venue.legalEntityName && !isOwner && (
            <p className="text-xs text-zinc-500">
              Trading as {venue.legalEntityName} on the payment page and policies. Ask Book Me In to change this, as it must match your card payment account.
            </p>
          )}
        </Block>

        {isOwner && (
          <Block title="Card payments" hint="Only owners see this. Which Dojo account takes this venue's payments.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name" hint="Shown on the payment page and policies. Must match the Dojo account.">
                <input type="text" name="legalEntityName" defaultValue={venue.legalEntityName ?? ""} className={input} />
              </Field>
              <Field label="Dojo account">
                <select name="paymentAccountId" defaultValue={venue.paymentAccount?.id ?? ""} className={input}>
                  <option value="">None, takes no payments</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {venue.paymentAccount && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
                <p>For this account to take payments, the customer site on Railway needs:</p>
                <p className="mt-1 font-mono text-zinc-800">
                  DOJO_API_KEY_{venue.paymentAccount.code}
                  <br />
                  DOJO_WEBHOOK_SECRET_{venue.paymentAccount.code}
                </p>
                <p className="mt-1">
                  and a webhook in Dojo pointing to <span className="font-mono text-zinc-800">{getCustomerAppUrl()}/api/webhooks/dojo/{venue.paymentAccount.code}</span>
                </p>
              </div>
            )}
          </Block>
        )}

        <Block title="How your booking page looks">
          <VenueLookFields
            venueName={venue.name}
            tagline={venue.tagline ?? ""}
            brandColorHex={venue.brandColorHex}
            logoSrc={logoSrc ?? null}
            headerSrc={headerSrc}
            framing={{ headerPosX: venue.headerPosX, headerPosY: venue.headerPosY, headerZoom: venue.headerZoom, headerDim: venue.headerDim }}
          />
        </Block>

        <Block title="Notifications" hint="Emails to your team when guests book online. Bookings staff add in the diary don't send these.">
          <Field label="Send them to" hint={`Leave blank to use ${venue.email ?? "the venue email"}.`}>
            <input type="email" name="notificationEmail" defaultValue={venue.notificationEmail ?? ""} placeholder={venue.email ?? "manager@venuename.co.uk"} className={input} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle name="notifyOnNewBooking" label="New bookings" detail="Once paid, for bookings that take payment." defaultChecked={venue.notifyOnNewBooking} />
            <Toggle name="notifyOnEnquiry" label="New enquiries" detail="Big groups and private hire waiting for you." defaultChecked={venue.notifyOnEnquiry} />
            <Toggle name="notifyOnCancellation" label="Cancellations" detail="When a guest cancels online." defaultChecked={venue.notifyOnCancellation} />
            <Toggle name="dailyDigest" label="Morning summary" detail="Today's bookings, covers, occasions and allergies, every morning." defaultChecked={venue.dailyDigest} />
          </div>
        </Block>

        <Block title="Reviews and tracking">
          <Field label="Google review link" hint="The thank-you email the day after a visit asks guests to leave a review here.">
            <input type="url" name="googleReviewUrl" defaultValue={venue.googleReviewUrl ?? ""} placeholder="https://g.page/r/..." className={input} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Google Analytics 4 ID" hint="Counts visits and completed bookings. Looks like G-XXXXXXX.">
              <input type="text" name="ga4MeasurementId" defaultValue={venue.ga4MeasurementId ?? ""} placeholder="G-XXXXXXXXXX" className={`${input} font-mono uppercase`} />
            </Field>
            <Field label="Meta pixel ID" hint="For Instagram and Facebook ads. Numbers only.">
              <input type="text" name="metaPixelId" inputMode="numeric" defaultValue={venue.metaPixelId ?? ""} placeholder="123456789012345" className={`${input} font-mono`} />
            </Field>
          </div>
        </Block>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white/90 py-3 backdrop-blur">
          <SubmitButton label="Save venue details" pendingLabel="Saving..." className={buttonStyles("primary", "md")} />
        </div>
      </ActionForm>
    </div>
  );
}
