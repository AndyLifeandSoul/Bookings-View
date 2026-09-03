import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { getCustomers } from "@/lib/admin/get-customers";

/** CSV download for the /admin/customers page — same filters, read straight off the query string so the page's "Export CSV" link can just carry its own filter state over. Plain Route Handler, not a Server Action, for the same Content-Disposition reason as marketing-export. */
export async function GET(request: NextRequest) {
  const session = await getCurrentStaffSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.role === "STAFF") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const customers = await getCustomers({
    venueId: params.get("venueId") || undefined,
    marketingOptIn: params.get("marketing") === "yes" ? true : params.get("marketing") === "no" ? false : undefined,
    dateFrom: params.get("dateFrom") ? new Date(`${params.get("dateFrom")}T00:00:00.000Z`) : undefined,
    dateTo: params.get("dateTo") ? new Date(`${params.get("dateTo")}T00:00:00.000Z`) : undefined,
    birthdayMonth: params.get("birthdayMonth") ? Number(params.get("birthdayMonth")) : undefined,
  });

  const header = ["Name", "Email", "Phone", "Date of birth", "Venues", "Bookings", "Last booking date", "Marketing opt-in"];
  const rows = customers.map((c) => [
    c.name,
    c.email ?? "",
    c.phone ?? "",
    c.dateOfBirth ? c.dateOfBirth.toISOString().slice(0, 10) : "",
    c.venueNames.join("; "),
    String(c.bookingCount),
    c.lastBookingDate.toISOString().slice(0, 10),
    c.marketingOptIn ? "Yes" : "No",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="life-and-soul-customers.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
