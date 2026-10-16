import { NextResponse, type NextRequest } from "next/server";
import { adminOnlyRoutes } from "@/lib/permissions";
import { ROLES_COOKIE, SESSION_COOKIE, findUserById, parseRoleOverrides, withRole } from "@/lib/users";

/**
 * Route protection (Next.js 16 renamed middleware to proxy).
 * - Not signed in → /login (remembering where you were going).
 * - Signed in and visiting /login → /dashboard.
 * - Admin-only pages → /forbidden for other roles.
 *
 * This is an optimistic check on the cookie. When the API exists, every
 * request is checked again on the server before data is returned.
 */
const PUBLIC_PATHS = ["/login", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const user = withRole(
    findUserById(request.cookies.get(SESSION_COOKIE)?.value),
    parseRoleOverrides(request.cookies.get(ROLES_COOKIE)?.value)
  );
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && user.role !== "Admin" && adminOnlyRoutes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
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
