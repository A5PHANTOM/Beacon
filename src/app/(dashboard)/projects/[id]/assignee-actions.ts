"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAssignableDevelopers, type ProjectAssignees } from "@/lib/project-assignees";

type Result = { success: true; data: ProjectAssignees } | { success: false; error: string };
export async function getProjectAssigneesAction(input: { projectId: string }): Promise<Result> {
  const parsed = z.object({ projectId: z.string().min(1).max(100) }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid project." };
  try {
    const session = await requireAuth();
    const { projectId } = parsed.data;
    const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: session.user.id } } });
    if (!membership && session.user.role !== "ADMIN") return { success: false, error: "You do not have access to this project." };
    return { success: true, data: await getAssignableDevelopers(projectId) };
  } catch {
    return { success: false, error: "Could not load assignable developers. Check the GitHub connection and retry; no unverified choices will be shown." };
  }
}
