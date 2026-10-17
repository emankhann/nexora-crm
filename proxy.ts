import { NextResponse, type NextRequest } from "next/server";
import { adminOnlyRoutes } from "@/lib/permissions";
import { SESSION_HINT_COOKIE, roleFromKey } from "@/lib/users";

/**
 * Route protection (Next.js 16 renamed middleware to proxy).
 * - Not signed in → /login (remembering where you were going).
 * - Signed in and visiting /login → /dashboard.
 * - Admin-only pages → /forbidden for other roles.
 *
 * This is an optimistic check on a small hint cookie the browser sets after
 * signing in (it holds only the role). It is not security: the Laravel API checks
 * the real httpOnly session on every request, and the app sends you to /login
 * as soon as the API says the session has ended.
 */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/accept-invite"];
/** Pages opened from an emailed link: they work even if someone is already signed in in this browser. */
const LINK_PATHS = ["/reset-password", "/accept-invite"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const role = roleFromKey(request.cookies.get(SESSION_HINT_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!role && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (role && isPublic && !LINK_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (role && role !== "Admin" && adminOnlyRoutes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/forbidden", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
