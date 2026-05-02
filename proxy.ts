import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = ["/login"];

  const isPublicRoute = publicRoutes.includes(pathname);
  const authToken = request.cookies.get("auth_token")?.value;

  if (!authToken && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authToken && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect all pages except:
     * - api routes
     * - Next static files
     * - images/icons
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};