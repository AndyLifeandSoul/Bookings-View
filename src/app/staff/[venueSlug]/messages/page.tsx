import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireStaffVenue } from "@/lib/staff/require-staff-venue";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Bookings with at least one unread inbound message, for this venue,
 * "unread" per Message.read's doc comment. Empty until email sending/
 * receiving is actually wired up (see lib/email/graph-client.ts), nothing
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
    <div className="animate-in mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Messages</h1>

      {bookings.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No unread messages.</p>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {bookings.map((booking) => {
            const latest = booking.messages[0];
            return (
              <Link key={booking.id} href={`/staff/${venue.slug}/bookings/${booking.id}`}>
                <Card interactive className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{booking.customerName}</span>
                      <span className="rounded-full bg-[var(--info-soft)] px-2 py-0.5 text-xs font-medium text-[var(--info-soft-text)]">
                        {booking._count.messages} unread
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {booking.bookingType.name} · {formatDate(booking.date)}, {booking.startTime}
                    </p>
                    {latest && <p className="mt-2 truncate text-sm text-zinc-600">{latest.body}</p>}
                  </div>
                  <MessageSquare className="h-4 w-4 shrink-0 text-zinc-300" strokeWidth={2} />
                </Card>
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
