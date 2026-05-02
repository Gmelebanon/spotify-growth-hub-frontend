import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/accounts",
  "/ads",
  "/ai",
  "/curation",
  "/manual-import",
  "/playlist-manager",
  "/playlists",
  "/production",
  "/settings",
  "/song-metrics",
  "/trades",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get("auth_token")?.value;

  if (!authToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/accounts/:path*",
    "/ads/:path*",
    "/ai/:path*",
    "/curation/:path*",
    "/manual-import/:path*",
    "/playlist-manager/:path*",
    "/playlists/:path*",
    "/production/:path*",
    "/settings/:path*",
    "/song-metrics/:path*",
    "/trades/:path*",
  ],
};