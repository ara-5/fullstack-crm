import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: bounce visitors with no session cookie to /login.
// Real authentication/authorization happens server-side in every page,
// Server Function and API route (see src/lib/session.ts and api-auth.ts).
export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const url = new URL("/login", request.url);
    const target = request.nextUrl.pathname + request.nextUrl.search;
    if (target !== "/") url.searchParams.set("callbackUrl", target);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!api|login|api-docs|_next/static|_next/image|favicon.ico).*)"],
};
