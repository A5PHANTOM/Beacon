import { z } from "zod";
import { prisma } from "./db";

const identitySchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1).max(39).regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/),
});
const emailSchema = z.array(z.object({ email: z.string().email(), verified: z.boolean() }));
const userSelect = { sessionVersion: true, id: true, name: true, email: true, role: true, githubId: true, githubLogin: true } as const;

export type GitHubLoginError = "GitHubIdentityInvalid" | "GitHubEmailUnavailable" | "GitHubNoBeaconAccount" | "GitHubAccountConflict";
export class GitHubLoginFailure extends Error {
  constructor(public readonly code: GitHubLoginError) { super(code); }
}

// The OAuth callback supplies a profile fetched by NextAuth from GitHub, not a client form.
// First-time linking additionally requires a verified email from GitHub's authenticated API.
export async function resolveGitHubLogin(profile: unknown, providerAccountId: string, accessToken: string) {
  const parsed = identitySchema.safeParse(profile);
  if (!parsed.success || String(parsed.data.id) !== providerAccountId || !accessToken) {
    throw new GitHubLoginFailure("GitHubIdentityInvalid");
  }
  const githubId = String(parsed.data.id);
  const githubLogin = parsed.data.login;
  const linked = await prisma.user.findUnique({ where: { githubId }, select: userSelect });
  if (linked) {
    // GitHub numeric IDs survive username/email changes. Never relink by a new email.
    return prisma.$transaction(async tx => {
      const changed = await tx.user.updateMany({ where: { id: linked.id, githubId, sessionVersion: linked.sessionVersion }, data: { githubLogin } });
      if (changed.count !== 1) throw new GitHubLoginFailure("GitHubAccountConflict");
      return tx.user.findUniqueOrThrow({ where: { id: linked.id }, select: userSelect });
    });
  }

  let emails: z.infer<typeof emailSchema>;
  try {
    const response = await fetch("https://api.github.com/user/emails?per_page=100", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error",
    });
    if (!response.ok) throw new Error("Email lookup failed");
    emails = emailSchema.parse(await response.json());
  } catch {
    throw new GitHubLoginFailure("GitHubEmailUnavailable");
  }
  const verifiedEmails = [...new Set(emails.filter(item => item.verified).map(item => item.email.trim().toLowerCase()))];
  if (!verifiedEmails.length) throw new GitHubLoginFailure("GitHubEmailUnavailable");
  const candidates = await prisma.user.findMany({ where: { email: { in: verifiedEmails } }, select: userSelect });
  if (!candidates.length) throw new GitHubLoginFailure("GitHubNoBeaconAccount");
  if (candidates.length !== 1) throw new GitHubLoginFailure("GitHubAccountConflict");
  const candidate = candidates[0];
  if (candidate.githubId && candidate.githubId !== githubId) throw new GitHubLoginFailure("GitHubAccountConflict");

  try {
    return await prisma.$transaction(async tx => {
      // Guard against concurrent links, email changes, and attempts to replace an identity.
      const result = await tx.user.updateMany({
        where: { id: candidate.id, sessionVersion: candidate.sessionVersion, email: { in: verifiedEmails }, OR: [{ githubId: null }, { githubId }] },
        data: { githubId, githubLogin },
      });
      if (result.count !== 1) throw new GitHubLoginFailure("GitHubAccountConflict");
      return tx.user.findUniqueOrThrow({ where: { id: candidate.id }, select: userSelect });
    });
  } catch {
    throw new GitHubLoginFailure("GitHubAccountConflict");
  }
}
