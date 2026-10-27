import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      githubLogin?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    sessionVersion?: number;
    id: string;
    role: string;
    githubLogin?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    sessionVersion?: number;
    githubLogin?: string | null;
  }
}
