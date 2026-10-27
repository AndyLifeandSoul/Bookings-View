import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Every online payment for bookings in a date range, for the accounts. Owners and managers only. */
export async function GET(request: NextRequest) {
  const session = await getCurrentStaffSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.role === "STAFF") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const p = request.nextUrl.searchParams;
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to)) return NextResponse.json({ error: "Give from and to as YYYY-MM-DD." }, { status: 400 });
  const venueId = p.get("venueId") || undefined;

  const payments = await prisma.payment.findMany({
    where: { ...(venueId ? { venueId } : {}), bookingDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) } },
    orderBy: [{ bookingDate: "asc" }, { createdAt: "asc" }],
    select: {
      createdAt: true,
      capturedAt: true,
      bookingDate: true,
      purpose: true,
      status: true,
      amountInPence: true,
      refundedAmountInPence: true,
      providerPaymentIntentId: true,
      venue: { select: { name: true } },
      booking: { select: { bookingRef: true, customerName: true } },
    },
  });

  const header = ["Venue", "Booking date", "Reference", "Guest", "What for", "Status", "Amount", "Refunded", "Net", "Taken at", "Dojo payment"];
  const money = (p: number) => (p / 100).toFixed(2);
  const purpose: Record<string, string> = { DEPOSIT: "Deposit", BALANCE: "Balance", FULL: "Paid in full", NO_SHOW_FEE: "No-show fee" };
  const rows = payments.map((x) => [
    x.venue.name,
    x.bookingDate.toISOString().slice(0, 10),
    x.booking?.bookingRef ?? "",
    x.booking?.customerName ?? "",
    purpose[x.purpose] ?? x.purpose,
    x.status.charAt(0) + x.status.slice(1).toLowerCase(),
    money(x.amountInPence),
    money(x.refundedAmountInPence),
    money(x.status === "CAPTURED" || x.status === "REFUNDED" ? x.amountInPence - x.refundedAmountInPence : 0),
    x.capturedAt ? x.capturedAt.toISOString().replace("T", " ").slice(0, 16) : "",
    x.providerPaymentIntentId ?? "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payments-${from}-to-${to}.csv"` },
  });
}
