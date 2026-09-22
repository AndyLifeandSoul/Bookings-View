import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/admin/purge-inbound-messages?ref=<bookingRef>
 *
 * Maintenance-only: deletes every INBOUND message on the booking with that
 * reference. Built to clear the mis-imported thread the old inbox-polling
 * bug attached to a booking (see poll-inbox), but kept as a general tidy-up
 * for any booking whose inbound messages need clearing (spam, a
 * mis-threaded reply). Never touches OUTBOUND rows, so the record of emails
 * the venue sent is preserved.
 *
 * Auth is the shared CRON_SECRET (same secret the poll endpoint uses), not
 * a staff session: this is an operator tool, not a UI action.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET isn't set." }, { status: 503 });
  }
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ref = request.nextUrl.searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ error: "Pass ?ref=<bookingRef>." }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({ where: { bookingRef: ref }, select: { id: true } });
  if (!booking) {
    return NextResponse.json({ error: `No booking found with reference "${ref}".` }, { status: 404 });
  }

  const result = await prisma.message.deleteMany({ where: { bookingId: booking.id, direction: "INBOUND" } });
  return NextResponse.json({ ok: true, bookingRef: ref, deleted: result.count });
}
