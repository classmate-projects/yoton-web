import { NextResponse, NextRequest } from "next/server";

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  if(pathname.startsWith("/login") && token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!token && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
     "/appointments/:path*",
     "/create-account/:path*",
     "/patient-entry/:path*",
     "/patient-records/:path*",
     "/user-registration/:path*",
      "/user-management/:path*",
]};
