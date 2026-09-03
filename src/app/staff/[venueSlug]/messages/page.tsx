import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";

export const dynamic = "force-dynamic";

/**
 * Bookings with at least one unread inbound message, for this venue —
 * "unread" per Message.read's doc comment. Empty until email sending/
 * receiving is actually wired up (see lib/email/graph-client.ts) — nothing
 * writes an INBOUND row yet without a configured mailbox, so this page
 * being empty on a fresh deploy isn't a bug.
 */
export default async function MessagesPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireStaffVenue(venueSlug);

  const bookings = await prisma.booking.findMany({
    where: { venueId: venue.id, messages: { some: { direction: "INBOUND", read: false } } },
    include: {
      bookingType: { select: { name: true } },
      messages: { where: { direction: "INBOUND", read: false }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { direction: "INBOUND", read: false } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Messages</h1>
      <p className="mt-1 text-sm text-zinc-500">Bookings with unread replies from a customer.</p>

      {bookings.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No unread messages.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {bookings.map((booking) => {
            const latest = booking.messages[0];
            return (
              <Link
                key={booking.id}
                href={`/staff/${venue.slug}/bookings/${booking.id}`}
                className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:border-[var(--accent)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">{booking.customerName}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {booking._count.messages} unread
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {booking.bookingType.name} · {formatDate(booking.date)}, {booking.startTime}
                  </p>
                  {latest && <p className="mt-2 truncate text-sm text-zinc-600">{latest.body}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
