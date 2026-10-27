import { getServerSession, type NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { GitHubLoginFailure, resolveGitHubLogin } from "./github-login";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.trim().toLowerCase();
        const rawPassword = credentials.password;

        let user = await prisma.user.findUnique({
          where: { email },
        });

        // Fresh deployment auto-bootstrap: if database has not been seeded yet and admin logs in
        if (!user && email === "admin@gmail.com" && await prisma.user.count() === 0) {
          try {
            const passwordHash = await bcrypt.hash("5678", 10);
            user = await prisma.user.create({
              data: {
                email: "admin@gmail.com",
                name: "System Admin",
                role: "ADMIN",
                passwordHash,
              },
            });
          } catch {
            user = await prisma.user.findUnique({ where: { email } });
          }
        }

        if (!user || !user.passwordHash) {
          return null;
        }

        // Upgrade the legacy system-admin default in existing deployments.
        // A later custom password is preserved; the old default is never accepted.
        if (email === "admin@gmail.com" && user.role === "ADMIN" &&
            await bcrypt.compare("1234", user.passwordHash)) {
          const passwordHash = await bcrypt.hash("5678", 10);
          await prisma.user.updateMany({
            where: { id: user.id, role: "ADMIN", passwordHash: user.passwordHash },
            data: { passwordHash },
          });
          // Re-read to respect a concurrent password change.
          user = await prisma.user.findUnique({ where: { email } });
          if (!user?.passwordHash) return null;
        }

        const isValid = await bcrypt.compare(rawPassword, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          githubLogin: user.githubLogin,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
    ...(process.env.GITHUB_ID?.trim() && process.env.GITHUB_SECRET?.trim() ? [
      GitHubProvider({
        clientId: process.env.GITHUB_ID.trim(),
        clientSecret: process.env.GITHUB_SECRET.trim(),
        authorization: { params: { scope: "read:user user:email" } },
        checks: ["state", "pkce"],
      }),
    ] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github") return true;
      try {
        const beaconUser = await resolveGitHubLogin(profile, account.providerAccountId, account.access_token ?? "");
        // NextAuth's JWT callback must receive the Beacon identity and saved role.
        user.id = beaconUser.id;
        user.name = beaconUser.name;
        user.email = beaconUser.email;
        user.role = beaconUser.role;
        user.githubLogin = beaconUser.githubLogin;
        user.sessionVersion = beaconUser.sessionVersion;
        return true;
      } catch (error) {
        const code = error instanceof GitHubLoginFailure ? error.code : "GitHubSignInFailed";
        return `/login?error=${code}`;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.githubLogin = user.githubLogin;
        token.sessionVersion = user.sessionVersion ?? 0;
        token.email = user.email;
        token.name = user.name;
      } else if (typeof token.id === "string") {
        const current = await prisma.user.findUnique({ where: { id: token.id }, select: { name: true, email: true, role: true, githubLogin: true, sessionVersion: true } });
        if (!current || current.sessionVersion !== (token.sessionVersion ?? 0)) throw new Error("SessionInvalidated");
        token.name = current.name;
        token.email = current.email;
        token.role = current.role;
        token.githubLogin = current.githubLogin;
      } else {
        throw new Error("SessionInvalidated");
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.githubLogin = token.githubLogin;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "beacon-production-secret-auth-key-2026-secure-random",
};

export async function getServerAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN: Admin access required");
  }
  return session;
}
