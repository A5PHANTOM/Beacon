import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { requiresPayment } from "./access-gate";

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
        if (!user && email === "admin@gmail.com") {
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "beacon-production-secret-auth-key-2026-secure-random",
};

// Identity only: use for routing and the locked screen, never for data access.
export async function getLoginSession() {
  return getServerSession(authOptions);
}

export async function getServerAuthSession() {
  const session = await getLoginSession();
  // Recheck on every server request, including sessions issued before the gate.
  return requiresPayment(session?.user?.email) ? null : session;
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
