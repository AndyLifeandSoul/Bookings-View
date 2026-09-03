"use client";

export function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        // Full navigation, not router.push — proxy.ts needs to see the
        // cleared cookie on the next request, which a client-side
        // transition isn't guaranteed to wait for.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }}
      className="text-sm text-zinc-500 underline hover:text-zinc-900"
    >
      Sign out
    </button>
  );
}
