import { Download, Megaphone } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function MarketingPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const bookings = await prisma.booking.findMany({
    where: { venueId: venue.id, marketingOptIn: true },
    orderBy: { createdAt: "desc" },
    select: { customerName: true, customerEmail: true, customerPhone: true, date: true },
  });

  // marketingOptIn only ever comes from the customer widget, which always
  // collects an email, but Booking.customerEmail is nullable in general
  // (see its doc comment), so this still guards rather than assuming.
  const byEmail = new Map<string, { name: string; email: string; phone: string | null; lastBookingDate: Date }>();
  for (const b of bookings) {
    if (!b.customerEmail) continue;
    const key = b.customerEmail.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, { name: b.customerName, email: b.customerEmail, phone: b.customerPhone, lastBookingDate: b.date });
    }
  }
  const customers = [...byEmail.values()];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Marketing opt-ins</h2>
        </div>
        <a href={`/api/admin/${venue.slug}/marketing-export`} className={buttonStyles("primary", "sm")}>
          <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
          Download CSV
        </a>
      </div>

      {customers.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <Megaphone className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-zinc-500">No opted-in customers yet.</p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Last booking</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.email} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                    <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                    <td className="px-4 py-3 text-zinc-600">{c.email}</td>
                    <td className="px-4 py-3 text-zinc-600">{c.phone ?? "-"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {c.lastBookingDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
