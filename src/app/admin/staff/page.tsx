import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { CreateStaffForm } from "./create-staff-form";
import { ToggleActiveButton, ResetPasswordButton } from "./staff-row-actions";

export const dynamic = "force-dynamic";

/**
 * Standalone top-level tab (/admin/staff), not nested under any venue —
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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Staff accounts</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Owner and Manager logins see every venue from one account. Staff logins are tied to exactly one venue&apos;s
        diary.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Venue</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {staffUsers.map((user) => (
              <tr key={user.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-zinc-900">{user.name}</td>
                <td className="px-4 py-2.5">{user.email}</td>
                <td className="px-4 py-2.5">{roleLabel(user.role)}</td>
                <td className="px-4 py-2.5 text-zinc-600">{user.venue?.name ?? "Every venue"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {user.active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
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

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-900">New account</h2>
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
