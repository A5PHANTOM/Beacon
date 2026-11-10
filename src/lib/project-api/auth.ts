import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { can, type ProjectAction } from "@/lib/permissions";
import type { GlobalRole, ProjectRole } from "@/lib/types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function authenticateApi(request: Request, projectId?: string) {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer bcn_[a-f0-9]{64}$/.test(header)) throw new ApiError(401, "A project API bearer key is required.");
  const token = await prisma.projectApiToken.findUnique({
    where: { tokenHash: hashToken(header.slice(7)) },
    include: { user: { select: { id: true, name: true, email: true, role: true, sessionVersion: true } } },
  });
  if (!token || token.expiresAt <= new Date() || token.sessionVersion !== token.user.sessionVersion) throw new ApiError(401, "API key is expired, revoked, or invalid.");
  if (projectId && token.projectId !== projectId) throw new ApiError(403, "This key belongs to a different project.");
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: token.projectId, userId: token.userId } } });
  if (token.user.role !== "ADMIN" && !member) throw new ApiError(403, "Project membership is required.");
  return { token, role: (member?.roleInProject ?? "VIEWER") as ProjectRole, session: { user: token.user, expires: token.expiresAt.toISOString() } };
}
export type ApiActor = Awaited<ReturnType<typeof authenticateApi>>;
export function authorizeMutation(actor: ApiActor, action: ProjectAction) {
  if (actor.token.access !== "WRITE") throw new ApiError(403, "This API key is read-only.");
  if (!can(actor.role, action, actor.token.user.role as GlobalRole)) throw new ApiError(403, "Your project role does not allow this action.");
}
export async function requireProjectIssue(projectId: string, issueId: string) {
  if (!await prisma.issue.findFirst({ where: { id: issueId, projectId }, select: { id: true } })) throw new ApiError(404, "Issue not found in this project.");
}
