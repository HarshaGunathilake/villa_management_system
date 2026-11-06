import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * A first, cheap gate: pages are not even served to a browser with no session
 * cookie. The real checks (valid session, role, villa and user active, villa
 * ownership of every record) happen in the API routes via lib/server/auth.ts.
 */
const PUBLIC = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/features", "/pricing", "/about", "/contact"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const signedIn = request.cookies.has("vms_admin");
    if (!signedIn && pathname !== "/admin/login") return NextResponse.redirect(new URL("/admin/login", request.url));
    return NextResponse.next();
  }

  // The landing page, signing in, signing up and password resets are the only pages open without a session.
  if (!request.cookies.has("vms_session") && !PUBLIC.has(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only. API routes answer with 401/403 themselves; static files are public.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
