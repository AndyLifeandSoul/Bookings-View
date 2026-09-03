import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminVenue } from "@/lib/admin/require-admin-venue";
import { listActiveVenues } from "@/lib/venues/list-active-venues";
import { CreateStaffForm } from "./create-staff-form";
import { ToggleActiveButton, ResetPasswordButton } from "./staff-row-actions";

export const dynamic = "force-dynamic";

/**
 * Not actually scoped to :venueSlug — staff accounts aren't a per-venue
 * concept (OWNER/MANAGER see every venue; STAFF's one venue is just a field
 * on the row) — but it lives under /admin/[venueSlug] like every other
 * admin page so the venue switcher and nav keep working the same way. The
 * route param is only used to run the same requireAdminVenue() guard
 * everything else here uses.
 */
export default async function StaffAccountsPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { session } = await requireAdminVenue(venueSlug);
  if (session.role !== "OWNER") redirect(`/admin/${venueSlug}/hours`);

  const [staffUsers, venues] = await Promise.all([
    prisma.staffUser.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { venue: { select: { name: true } } },
    }),
    listActiveVenues(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Staff accounts</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Owner and Manager logins see every venue from one account. Staff logins are tied to exactly one venue&apos;s
          diary.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
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

      <div>
        <h3 className="text-sm font-semibold text-zinc-900">New account</h3>
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
