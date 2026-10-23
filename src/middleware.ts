import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { requiresPayment } from "@/lib/access-gate";

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  "beacon-production-secret-auth-key-2026-secure-random";

export default withAuth(function middleware(request) {
  if (requiresPayment(request.nextauth.token?.email)) {
    return NextResponse.redirect(new URL("/payment-required", request.url));
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
