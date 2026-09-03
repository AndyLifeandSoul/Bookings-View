import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";

/**
 * CSV download of customers who opted in to marketing at booking time —
 * plain Route Handler rather than a Server Action, since a Server Action
 * can't control response headers (Content-Disposition) the way a file
 * download needs. Auth is checked directly here (not requireAdminSession(),
 * which redirect()s — the wrong behaviour for an API response) so an
 * unauthenticated or STAFF request gets a plain 401/403, not a redirect.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ venueSlug: string }> }) {
  const session = await getCurrentStaffSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.role === "STAFF") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { venueSlug } = await params;
  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug }, select: { id: true, name: true } });
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });

  const bookings = await prisma.booking.findMany({
    where: { venueId: venue.id, marketingOptIn: true },
    orderBy: { createdAt: "desc" },
    select: { customerName: true, customerEmail: true, customerPhone: true, date: true, createdAt: true },
  });

  // One row per customer — the most recent booking's name/phone win, since
  // that's the freshest contact detail for someone who's booked more than
  // once, but every opted-in booking still counts toward "has opted in".
  const byEmail = new Map<string, { name: string; email: string; phone: string; lastBookingDate: string }>();
  for (const b of bookings) {
    const key = b.customerEmail.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, {
        name: b.customerName,
        email: b.customerEmail,
        phone: b.customerPhone ?? "",
        lastBookingDate: b.date.toISOString().slice(0, 10),
      });
    }
  }

  const rows = [...byEmail.values()];
  const header = ["Name", "Email", "Phone", "Last booking date"];
  const csv = [header, ...rows.map((r) => [r.name, r.email, r.phone, r.lastBookingDate])]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  const filename = `${venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-marketing-opt-ins.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
