import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/** Only reachable when not already logged in — middleware.ts redirects an existing session straight to /staff. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // "/" is the role-aware landing resolver (see its page.tsx) — OWNER/
  // MANAGER land on the admin dashboard, STAFF on their venue's diary.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-zinc-900">Staff sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">Life &amp; Soul Bookings</p>
        <div className="mt-6">
          <LoginForm next={safeNext} />
        </div>
      </div>
    </div>
  );
}
