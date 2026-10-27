"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { GlobalRole, ProjectRole } from "@/lib/types";
import { githubConnectionSchema, githubProjectSchema } from "@/lib/github-validation";
import { encryptGitHubToken, githubRequest, syncIssueToGitHub } from "@/lib/github";

type Result = { success: true; data: { message: string } } | { success: false; error: string };
async function authorize(projectId: string) {
  const session = await requireAuth();
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: session.user.id } } });
  if (!can((member?.roleInProject ?? "VIEWER") as ProjectRole, "project:github", session.user.role as GlobalRole)) throw new Error("Only project developers, leads, and administrators can manage GitHub sync.");
  if (!await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })) throw new Error("Project not found.");
  return session;
}
export async function connectGitHubAction(input: z.infer<typeof githubConnectionSchema>): Promise<Result> {
  const parsed = githubConnectionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  try {
    const { projectId, owner, repo, token } = parsed.data;
    await authorize(projectId);
    const encryptedToken = encryptGitHubToken(token);
    const remote = z.object({ has_issues: z.boolean(), permissions: z.object({ push: z.boolean().optional(), maintain: z.boolean().optional(), admin: z.boolean().optional(), triage: z.boolean().optional() }).optional() }).parse(await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`));
    if (!remote.has_issues) return { success: false, error: "Enable Issues in the GitHub repository first." };
    // Listing confirms the token can access Issues without creating a test issue.
    await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?per_page=1`);
    await prisma.$transaction(async tx => {
      const previous = await tx.gitHubConnection.findUnique({ where: { projectId } });
      if (previous && `${previous.owner}/${previous.repo}`.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) throw new Error("This project is already linked to a different repository. Reconnect the same repository to preserve issue links.");
      await tx.gitHubConnection.upsert({ where: { projectId }, create: { projectId, owner, repo, encryptedToken }, update: { encryptedToken, enabled: true } });
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: { message: "GitHub connected. New issues sync automatically. Use Sync pending to include existing issues." } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { success: false, error: /^(GitHub|Only project|Project not found|Configure GITHUB|This project)/.test(message) ? message : "Could not connect GitHub. Check repository access and Issues read/write permission." };
  }
}
export async function disconnectGitHubAction(input: z.infer<typeof githubProjectSchema>): Promise<Result> {
  const parsed = githubProjectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid project." };
  try {
    await authorize(parsed.data.projectId);
    await prisma.gitHubConnection.updateMany({ where: { projectId: parsed.data.projectId }, data: { enabled: false } });
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { success: true, data: { message: "GitHub sync paused. Existing issue links are preserved." } };
  } catch { return { success: false, error: "Could not pause sync. Check your project permissions." }; }
}
export async function retryGitHubSyncAction(input: z.infer<typeof githubProjectSchema>): Promise<Result> {
  const parsed = githubProjectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid project." };
  try {
    const { projectId } = parsed.data;
    const session = await authorize(projectId);
    const connection = await prisma.gitHubConnection.findUnique({ where: { projectId } });
    if (!connection?.enabled) return { success: false, error: "Connect GitHub before syncing." };
    const issues = await prisma.issue.findMany({ where: { projectId }, select: { id: true, updatedAt: true, githubSync: true }, orderBy: { createdAt: "asc" } });
    const pending = issues.filter(i => !i.githubSync?.syncedAt || i.githubSync.lastError || i.githubSync.syncedAt < i.updatedAt);
    // Small batches keep retries within a serverless request's execution budget.
    for (const issue of pending.slice(0, 3)) await syncIssueToGitHub(issue.id, session.user.id);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: { message: "Sync attempted for up to 3 pending issues. Check errors below; run again for remaining issues." } };
  } catch { return { success: false, error: "Could not sync. Check your connection and project permissions, then retry." }; }
}
