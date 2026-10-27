import { prisma } from "@/lib/db/client";
import { customerIdentity } from "./customer-record";

/**
 * Tags and allergies kept on each guest's record (Customer), looked up for
 * a list of bookings in one go, so the diary and run sheet can flag a VIP
 * or an allergy on file even when this booking didn't mention it.
 */
export async function guestFlagsFor(
  bookings: { id: string; customerEmail: string | null; customerPhone: string | null }[],
): Promise<Map<string, { tags: string[]; allergies: string | null }>> {
  const ids = bookings.map((b) => ({ id: b.id, identity: customerIdentity(b.customerEmail, b.customerPhone) }));
  const emails = [...new Set(ids.map((x) => x.identity?.email).filter((e): e is string => !!e))];
  const phones = [...new Set(ids.filter((x) => x.identity && !x.identity.email).map((x) => x.identity!.phone!))];
  if (emails.length === 0 && phones.length === 0) return new Map();
  const rows = await prisma.customer.findMany({
    where: { OR: [...(emails.length ? [{ email: { in: emails } }] : []), ...(phones.length ? [{ email: null, phone: { in: phones } }] : [])] },
    select: { email: true, phone: true, tags: true, allergies: true },
  });
  const byEmail = new Map(rows.filter((r) => r.email).map((r) => [r.email!, r]));
  const byPhone = new Map(rows.filter((r) => !r.email && r.phone).map((r) => [r.phone!, r]));
  const out = new Map<string, { tags: string[]; allergies: string | null }>();
  for (const { id, identity } of ids) {
    if (!identity) continue;
    const row = identity.email ? byEmail.get(identity.email) : byPhone.get(identity.phone!);
    if (row && (row.tags.length || row.allergies)) out.set(id, { tags: row.tags, allergies: row.allergies });
  }
  return out;
}
