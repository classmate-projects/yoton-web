import { NextResponse, NextRequest } from "next/server";

const publicPaths = ["/login", "/forgot-password", "/register-company"];

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  if (isPublicPath(pathname) && token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!token && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
