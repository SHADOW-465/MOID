// Next.js 16 proxy (formerly middleware). Auth is always on: unauthenticated
// page requests go to /login; API routes get 401.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  // login + logins list + logout + me are public; me still returns 401 if needed
  if (pathname.startsWith("/api/auth/")) return true;
  // Plant compose health probe (nginx) — not an app route, but allow if proxied.
  if (pathname === "/healthz") return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    const res = NextResponse.next();
    res.headers.set("x-moid-user", session.u);
    res.headers.set("x-moid-role", session.r);
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized. Sign in required." },
      { status: 401 },
    );
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next internals and common static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
