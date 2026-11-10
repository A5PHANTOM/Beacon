"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/project-api/auth";

import { projectApiKeySchema as inputSchema } from "@/lib/project-api/key-validation";
async function access(projectId: string) {
  const session = await requireAuth();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, role: true, sessionVersion: true } });
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } });
  if (!project || (user.role !== "ADMIN" && !member)) throw new Error("Access denied");
  return { user, member };
}
export async function createProjectApiKey(input: z.infer<typeof inputSchema>) {
  try {
    const data = inputSchema.parse(input);
    const { user, member } = await access(data.projectId);
    if (data.access === "WRITE" && user.role !== "ADMIN" && member?.roleInProject === "VIEWER") return { success: false as const, error: "Viewers can only create read-only keys." };
    const key = `bcn_${randomBytes(32).toString("hex")}`;
    const expiresAt = new Date(Date.now() + data.days * 86400000);
    await prisma.projectApiToken.create({ data: { projectId: data.projectId, userId: user.id, name: data.name, access: data.access, tokenHash: hashToken(key), sessionVersion: user.sessionVersion, expiresAt } });
    return { success: true as const, data: { key, expiresAt: expiresAt.toISOString() } };
  } catch { return { success: false as const, error: "Could not create API key. Check your project access and inputs." }; }
}
export async function listProjectApiKeys(projectId: string) {
  try {
    z.string().min(1).max(100).parse(projectId);
    const { user } = await access(projectId);
    const data = await prisma.projectApiToken.findMany({ where: { projectId, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }, select: { id: true, name: true, access: true, expiresAt: true }, orderBy: { createdAt: "desc" } });
    return { success: true as const, data: data.map(t => ({ ...t, expiresAt: t.expiresAt.toISOString() })) };
  } catch { return { success: false as const, error: "Could not load API keys." }; }
}
export async function revokeProjectApiKey(input: { projectId: string; id: string }) {
  try {
    const { projectId, id } = z.object({ projectId: z.string().min(1).max(100), id: z.string().min(1).max(100) }).parse(input);
    const { user } = await access(projectId);
    await prisma.projectApiToken.deleteMany({ where: { id, projectId, ...(user.role === "ADMIN" ? {} : { userId: user.id }) } });
    return { success: true as const, data: null };
  } catch { return { success: false as const, error: "Could not revoke API key." }; }
}
