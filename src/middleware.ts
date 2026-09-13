import { withAuth } from "next-auth/middleware";

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  "beacon-production-secret-auth-key-2026-secure-random";

export default withAuth({
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
  matcher: ["/projects/:path*", "/admin/:path*"],
};
