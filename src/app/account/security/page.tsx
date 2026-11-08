import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { getCurrentStaffSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";
import { TwoStepPanel } from "./two-step-panel";

export const dynamic = "force-dynamic";

/** Every login's own sign-in security: two-step sign-in with an authenticator app. */
export default async function SecurityPage() {
  const session = await getCurrentStaffSession();
  if (!session) redirect("/login?next=/account/security");
  const user = await prisma.staffUser.findUnique({
    where: { id: session.staffUserId },
    select: { email: true, totpEnabledAt: true, lastLoginAt: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <div className="bg-zinc-950 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <BrandLogo markSize={22} />
          <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} /> Back
          </Link>
        </div>
      </div>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign-in security</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
        <Card className="mt-6 p-5">
          <TwoStepPanel enabledAt={user.totpEnabledAt ? user.totpEnabledAt.toISOString() : null} />
        </Card>
        <p className="mt-4 text-xs text-zinc-500">
          After 5 wrong passwords or codes in a row, a login is locked for 15 minutes. An owner can unlock it, reset the password or switch two-step sign-in off from Staff.
        </p>
      </div>
    </div>
  );
}
