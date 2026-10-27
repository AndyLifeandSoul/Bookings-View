import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { customerIdentity, getCustomerProfile, guestHistory, guestStats } from "@/lib/admin/customer-record";
import { GuestPanel } from "@/components/guest-panel";
import { Card } from "@/components/ui/card";
import { updateCustomerProfile } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * One guest across every venue: contact details, tags, allergies, notes and
 * every booking. Reached from the Customers list by one of their bookings,
 * so no email or phone number ever sits in the address bar.
 */
export default async function CustomerProfilePage({ params }: { params: Promise<{ bookingId: string }> }) {
  await requireAdminSession();
  const { bookingId } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, customerName: true, customerEmail: true, customerPhone: true, customerDateOfBirth: true, marketingOptIn: true },
  });
  if (!booking) notFound();
  const identity = customerIdentity(booking.customerEmail, booking.customerPhone);
  if (!identity) notFound();
  const [profile, visits] = await Promise.all([getCustomerProfile(identity), guestHistory(identity)]);
  const stats = guestStats(visits);
  const covers = visits.filter((v) => v.status === "COMPLETED").reduce((s, v) => s + v.partySize, 0);

  return (
    <div className="animate-in mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ChevronLeft className="h-4 w-4" /> Customers
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{booking.customerName}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
            {booking.customerEmail && (
              <a href={`mailto:${booking.customerEmail}`} className="inline-flex items-center gap-1 hover:text-zinc-900">
                <Mail className="h-3.5 w-3.5" /> {booking.customerEmail}
              </a>
            )}
            {booking.customerPhone && (
              <a href={`tel:${booking.customerPhone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 hover:text-zinc-900">
                <Phone className="h-3.5 w-3.5" /> {booking.customerPhone}
              </a>
            )}
            <span>{booking.marketingOptIn ? "Happy to get marketing" : "No marketing"}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Visits", value: String(stats.visits), note: covers ? `${covers} covers` : undefined },
          { label: "Coming up", value: String(stats.upcoming) },
          { label: "No-shows", value: String(stats.noShows), note: stats.cancellations ? `${stats.cancellations} cancelled` : undefined },
          { label: "Paid online", value: `£${(stats.spentPence / 100).toFixed(2)}` },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{s.label}</span>
            <span className="text-2xl font-semibold tabular-nums text-zinc-900">{s.value}</span>
            {s.note && <span className="text-xs text-zinc-500">{s.note}</span>}
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <GuestPanel
          key={`${profile.tags.join("|")}:${profile.allergies}:${profile.staffNotes}`}
          profile={profile}
          visits={visits}
          action={updateCustomerProfile}
          hidden={{ bookingId: booking.id }}
          visitHref={(v) => `/staff/${v.venueSlug}/bookings/${v.id}`}
          showHistory={50}
        />
      </div>
    </div>
  );
}
