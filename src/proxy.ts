import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * This whole app is the staff/admin surface — unlike lifeandsoul-bookings
 * (customer-facing, no auth at all), everything here except /login requires
 * a valid session. Named proxy.ts, not middleware.ts — Next.js 16 renamed
 * the convention (middleware.ts still half-works but prints a deprecation
 * warning on build; see node_modules/next/dist/docs/.../proxy.md). Runs on
 * the Node.js runtime by default as of v16 (earlier versions defaulted to
 * Edge) — jose still works fine either way, that's not why it was chosen
 * here, it's just a small dependency-free JWT library.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Has to stay open regardless of session state — this is the endpoint
  // that CREATES the session. Gating it the same as everything else is a
  // real bug that was caught in testing: nobody can ever log in, because
  // the very first POST to /api/auth/login (with no cookie yet) gets
  // redirected to /login before it runs, and the client-side fetch()
  // silently follows that redirect instead of getting the login response.
  // /api/auth/logout is equally fine to leave open — it only ever clears a
  // cookie, there's nothing to protect.
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/staff", request.url));
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin covers venue/booking-type/hours/menu configuration — deliberately
  // not open to plain STAFF, only whoever runs the venue (or the wider
  // business). Nothing under /admin exists yet, but the gate is worth
  // having in place before that surface does.
  if (pathname.startsWith("/admin") && session.role === "STAFF") {
    return NextResponse.redirect(new URL("/staff", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except static assets and the Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
