import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * A first, cheap gate: pages are not even served to a browser with no session
 * cookie. The real checks (valid session, role, villa and user active, villa
 * ownership of every record) happen in the API routes via lib/server/auth.ts.
 */
const PUBLIC = new Set(["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]);

/** The public website's pages now live on its own domain (NEXT_PUBLIC_SITE_URL); old links go there. */
const WEBSITE_PAGES = new Set(["/features", "/pricing", "/about", "/contact", "/llms.txt", "/sitemap.xml"]);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (WEBSITE_PAGES.has(pathname)) {
    return NextResponse.redirect(SITE_URL ? `${SITE_URL}${pathname}` : new URL("/login", request.url), 308);
  }

  // The app's front door: the dashboard when signed in, otherwise sign-in.
  if (pathname === "/") return NextResponse.redirect(new URL(request.cookies.has("vms_session") ? "/dashboard" : "/login", request.url));

  if (pathname.startsWith("/admin")) {
    const signedIn = request.cookies.has("vms_admin");
    if (!signedIn && pathname !== "/admin/login") return NextResponse.redirect(new URL("/admin/login", request.url));
    return NextResponse.next();
  }

  // Signing in, signing up and password resets are the only pages open without a session.
  if (!request.cookies.has("vms_session") && !PUBLIC.has(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only, plus the website's old files (now redirected). API routes answer with 401/403 themselves; static files are public.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)", "/llms.txt", "/sitemap.xml"],
};
