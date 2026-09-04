import { UserCog } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateStaffForm } from "./create-staff-form";
import { ToggleActiveButton, ResetPasswordButton } from "./staff-row-actions";

export const dynamic = "force-dynamic";

/**
 * Standalone top-level tab (/admin/staff), not nested under any venue,
 * staff accounts aren't a per-venue concept (OWNER/MANAGER see every venue;
 * STAFF's one venue is just a field on the row), so this doesn't belong in
 * a venue's settings sub-nav. OWNER-only, checked here (redirect) and again
 * in every action in ./actions.ts (defence in depth, same as the rest of
 * /admin).
 */
export default async function StaffAccountsPage() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER") redirect("/admin");

  const [staffUsers, venues] = await Promise.all([
    prisma.staffUser.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { venue: { select: { name: true } } },
    }),
    listActiveVenues(),
  ]);

  return (
    <div className="animate-in mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-soft-text)]">
          <UserCog className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Staff accounts</h1>
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        Owner and Manager logins see every venue from one account. Staff logins are tied to exactly one venue&apos;s
        diary.
      </p>

      <Card padded={false} className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Venue</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {staffUsers.map((user) => (
                <tr key={user.id} className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40">
                  <td className="px-4 py-3 font-medium text-zinc-900">{user.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{user.email}</td>
                  <td className="px-4 py-3 text-zinc-600">{roleLabel(user.role)}</td>
                  <td className="px-4 py-3 text-zinc-600">{user.venue?.name ?? "Every venue"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.active ? "success" : "neutral"}>{user.active ? "Active" : "Deactivated"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-3">
                        <ResetPasswordButton id={user.id} />
                        <ToggleActiveButton id={user.id} active={user.active} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">New account</h2>
        <div className="mt-3">
          <CreateStaffForm venues={venues} />
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
