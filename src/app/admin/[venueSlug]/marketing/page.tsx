import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";

export const dynamic = "force-dynamic";

export default async function MarketingPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireAdminVenue(venueSlug);

  const bookings = await prisma.booking.findMany({
    where: { venueId: venue.id, marketingOptIn: true },
    orderBy: { createdAt: "desc" },
    select: { customerName: true, customerEmail: true, customerPhone: true, date: true },
  });

  const byEmail = new Map<string, { name: string; email: string; phone: string | null; lastBookingDate: Date }>();
  for (const b of bookings) {
    const key = b.customerEmail.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, { name: b.customerName, email: b.customerEmail, phone: b.customerPhone, lastBookingDate: b.date });
    }
  }
  const customers = [...byEmail.values()];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Marketing opt-ins</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Customers who ticked the marketing consent box at booking time — never inferred, only what they actually
            checked.
          </p>
        </div>
        <a
          href={`/api/admin/${venue.slug}/marketing-export`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Download CSV
        </a>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No opted-in customers yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Last booking</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.email} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">{c.name}</td>
                  <td className="px-4 py-2.5">{c.email}</td>
                  <td className="px-4 py-2.5">{c.phone ?? "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-500">
                    {c.lastBookingDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
