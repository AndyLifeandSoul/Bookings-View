import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { isInboxConfigured, listRecentInbox } from "@/lib/email/inbox";

/**
 * Polls every venue's real mailbox for new mail and turns each one into an
 * INBOUND Message row (read: false) on whichever booking it's a reply to,
 * see docs/email-setup.md for the full picture and how to point a
 * scheduler at this. Not a Graph webhook on purpose: no public endpoint
 * validation handshake or subscription-renewal cron needed, at the cost of
 * near-real-time becoming "as fresh as the last poll", fine for booking
 * replies, not for live chat.
 *
 * Auth is a shared secret (CRON_SECRET), not a staff session, this is
 * called by a scheduler, not a browser. Returns 200 with a no-op summary
 * (not an error) when email isn't configured yet, so an unconfigured
 * deploy's scheduler doesn't sit there erroring every run.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d{1,7});/g, (whole, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return whole;
      }
    })
    .replace(/&amp;/gi, "&");
}

/**
 * Cuts an email reply down to just the new message, dropping the quoted
 * original beneath it. The body is already flattened to a single line by
 * stripHtml, so we cut at the earliest quote marker: Outlook's
 * "From: ... Sent:" / "From: ... To: ... Subject:" header, the Gmail/Apple
 * "On ... wrote:" line, or an "Original Message" divider. If cutting would
 * leave nothing (a reply that is only quoted text), keep the decoded body
 * rather than storing a blank message.
 */
function stripQuotedReply(text: string): string {
  const markers: RegExp[] = [
    /-{2,}\s*Original Message\s*-{2,}/i,
    /\bFrom:\s.+?\bSent:\s/i,
    /\bFrom:\s.+?\bTo:\s.+?\bSubject:/i,
    /\bOn\s.{1,160}?\bwrote:/i,
  ];
  let cut = text.length;
  for (const re of markers) {
    const m = text.match(re);
    if (m && m.index !== undefined && m.index < cut) cut = m.index;
  }
  return text.slice(0, cut).trim();
}

/** Decode entities, drop the quoted thread, and tidy whitespace. */
function cleanInboundBody(raw: string): string {
  const decoded = decodeEntities(raw).replace(/\s+/g, " ").trim();
  const trimmed = stripQuotedReply(decoded);
  return trimmed || decoded;
}

/**
 * A booking whose date is yesterday or later, for the sender-address
 * fallback match (see below).
 */
function yesterdayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
}

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET isn't set, refusing to run an unauthenticated poll." }, { status: 503 });
  }
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isInboxConfigured()) {
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
        // Fallback for replies whose subject lost the booking reference:
        // match on the sender's address, but only to a current or upcoming
        // booking (date from yesterday on), so an old thread from someone
        // who happens to be a past customer can't attach to their booking.
        if (!bookingId && message.from) {
          const byEmail = await prisma.booking.findFirst({
            where: {
              venueId: venue.id,
              customerEmail: { equals: message.from, mode: "insensitive" },
              status: { not: "CANCELLED" },
              date: { gte: yesterdayUtc() },
            },
            orderBy: { date: "asc" },
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
            body: cleanInboundBody(message.bodyText),
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
