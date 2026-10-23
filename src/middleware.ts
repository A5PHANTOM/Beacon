import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { requiresPayment, PAYMENT_REQUIRED_ERROR } from "@/lib/access-gate";

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  "beacon-production-secret-auth-key-2026-secure-random";

export default withAuth(function middleware(request) {
  if (requiresPayment(request.nextauth.token?.email)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", PAYMENT_REQUIRED_ERROR);
    return NextResponse.redirect(loginUrl);
  }
}, {
  secret: AUTH_SECRET,
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

export const config = {
  matcher: ["/projects/:path*", "/admin/:path*", "/analytics/:path*", "/timesheets/:path*"],
};
