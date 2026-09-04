import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { isEmailConfigured, listRecentInbox } from "@/lib/email/graph-client";

/**
 * Polls every venue's real mailbox for new mail and turns each one into an
 * INBOUND Message row (read: false) on whichever booking it's a reply to —
 * see docs/email-setup.md for the full picture and how to point a
 * scheduler at this. Not a Graph webhook on purpose: no public endpoint
 * validation handshake or subscription-renewal cron needed, at the cost of
 * near-real-time becoming "as fresh as the last poll" — fine for booking
 * replies, not for live chat.
 *
 * Auth is a shared secret (CRON_SECRET), not a staff session — this is
 * called by a scheduler, not a browser. Returns 200 with a no-op summary
 * (not an error) when email isn't configured yet, so an unconfigured
 * deploy's scheduler doesn't sit there erroring every run.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET isn't set, refusing to run an unauthenticated poll." }, { status: 503 });
  }
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: true, configured: false, venuesPolled: 0, messagesCreated: 0 });
  }

  const venues = await prisma.venue.findMany({
    where: { active: true, email: { not: null } },
    select: { id: true, slug: true, email: true, lastInboxSyncAt: true },
  });

  let messagesCreated = 0;
  const errors: string[] = [];

  for (const venue of venues) {
    if (!venue.email) continue;
    try {
      const messages = await listRecentInbox(venue.email, venue.lastInboxSyncAt?.toISOString() ?? null);
      if (messages.length === 0) continue;

      // Every booking at this venue with a reference, to match a reply
      // subject ("RE: Your booking DV8-030901 is confirmed") back to it.
      const bookingsWithRef = await prisma.booking.findMany({
        where: { venueId: venue.id, bookingRef: { not: null } },
        select: { id: true, bookingRef: true },
      });

      for (const message of messages) {
        const matchedByRef = bookingsWithRef.find((b) => b.bookingRef && message.subject.includes(b.bookingRef));

        let bookingId = matchedByRef?.id ?? null;
        if (!bookingId && message.from) {
          const byEmail = await prisma.booking.findFirst({
            where: { venueId: venue.id, customerEmail: { equals: message.from, mode: "insensitive" }, status: { not: "CANCELLED" } },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          bookingId = byEmail?.id ?? null;
        }

        if (!bookingId) {
          errors.push(`${venue.slug}: couldn't match a message from ${message.from} ("${message.subject}") to any booking.`);
          continue;
        }

        await prisma.message.create({
          data: {
            bookingId,
            direction: "INBOUND",
            subject: message.subject || null,
            body: message.bodyText,
            read: false,
          },
        });
        messagesCreated += 1;
      }

      const latest = messages[messages.length - 1];
      await prisma.venue.update({ where: { id: venue.id }, data: { lastInboxSyncAt: new Date(latest.receivedDateTime) } });
    } catch (err) {
      errors.push(`${venue.slug}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return NextResponse.json({ ok: true, configured: true, venuesPolled: venues.length, messagesCreated, errors });
}
