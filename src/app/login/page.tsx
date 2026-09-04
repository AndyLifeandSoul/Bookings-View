import Image from "next/image";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/** Only reachable when not already logged in, middleware.ts redirects an existing session straight to /staff. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // "/" is the role-aware landing resolver (see its page.tsx), OWNER/
  // MANAGER land on the admin dashboard, STAFF on their venue's diary.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_28rem_at_50%_-10%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent)]" />
      <div className="animate-in relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <Image src="/brand/life-and-soul-wordmark.png" alt="Life & Soul" width={945} height={174} className="h-9 w-auto" priority />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Staff sign in</h1>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 [box-shadow:var(--shadow-lg)]">
          <LoginForm next={safeNext} />
        </div>
      </div>
    </div>
  );
}
