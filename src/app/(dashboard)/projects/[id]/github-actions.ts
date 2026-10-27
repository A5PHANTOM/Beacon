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
    const pending = issues.filter(i => !i.githubSync?.assignmentSynced || !i.githubSync.syncedAt || i.githubSync.lastError || i.githubSync.syncedAt < i.updatedAt);
    // Small batches keep retries within a serverless request's execution budget.
    for (const issue of pending.slice(0, 3)) await syncIssueToGitHub(issue.id, session.user.id);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: { message: "Sync attempted for up to 3 pending issues. Check errors below; run again for remaining issues." } };
  } catch { return { success: false, error: "Could not sync. Check your connection and project permissions, then retry." }; }
}

export async function enableGitHubUpdatesAction(input: z.infer<typeof githubProjectSchema>): Promise<Result> {
  const parsed = githubProjectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid project." };
  try {
    const { projectId } = parsed.data;
    await authorize(projectId);
    const connection = await prisma.gitHubConnection.findUnique({ where: { projectId } });
    if (!connection?.enabled) return { success: false, error: "Connect and resume the GitHub repository first." };
    const baseUrl = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
    if (baseUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(baseUrl.hostname)) return { success: false, error: "Enable GitHub updates on your deployed Beacon site. GitHub cannot deliver webhooks to localhost." };
    const callback = `${baseUrl.origin}/api/github/webhooks/${encodeURIComponent(projectId)}`;
    const { randomBytes } = await import("node:crypto");
    const { decryptGitHubToken } = await import("@/lib/github-api");
    const token = decryptGitHubToken(connection.encryptedToken);
    const base = `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`;
    const repository = z.object({ id: z.number().int().positive(), has_issues: z.boolean() }).parse(await githubRequest(token, base));
    if (!repository.has_issues) return { success: false, error: "Enable Issues in the GitHub repository first." };
    if (connection.githubRepositoryId && connection.githubRepositoryId !== String(repository.id)) return { success: false, error: "The repository identity changed. Existing issue links cannot be moved to another repository." };
    // Establish a stable per-project secret. Concurrent setup attempts must use
    // the winner's secret, and must never rotate a working webhook implicitly.
    await prisma.gitHubConnection.updateMany({ where: { projectId, encryptedWebhookSecret: null }, data: { encryptedWebhookSecret: encryptGitHubToken(randomBytes(32).toString("hex")) } });
    await prisma.gitHubConnection.update({ where: { projectId }, data: { githubRepositoryId: String(repository.id) } });
    const saved = await prisma.gitHubConnection.findUniqueOrThrow({ where: { projectId } });
    const hookSchema = z.object({ id: z.number().int().positive(), config: z.object({ url: z.string() }) });
    let matching: z.infer<typeof hookSchema>[] = [];
    for (let page = 1; page <= 5; page++) {
      const hooks = z.array(hookSchema).parse(await githubRequest(token, `${base}/hooks?per_page=100&page=${page}`));
      matching = matching.concat(hooks.filter(hook => hook.config.url === callback));
      if (hooks.length < 100) break;
      if (page === 5) throw new Error("Incomplete webhook list");
    }
    if (matching.length > 1) return { success: false, error: "Multiple Beacon webhooks match this project. Keep one matching webhook in GitHub settings, then retry." };
    const config = { url: callback, content_type: "json", insecure_ssl: "0", secret: decryptGitHubToken(saved.encryptedWebhookSecret!) };
    const activeHookSchema = hookSchema.extend({ active: z.literal(true), events: z.array(z.string()).refine(events => events.includes("issues")) });
    const hook = activeHookSchema.parse(await githubRequest(token, matching.length ? `${base}/hooks/${matching[0].id}` : `${base}/hooks`, matching.length ? "PATCH" : "POST", { ...(matching.length ? {} : { name: "web" }), active: true, events: ["issues"], config }));
    if (hook.config.url !== callback) throw new Error("Webhook callback was not applied");
    await prisma.gitHubConnection.update({ where: { projectId }, data: { webhookId: hook.id, inboundEnabled: true, lastWebhookError: null } });
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: { message: "GitHub updates enabled. Linked issues can now reopen or close in Beacon when permitted by the workflow." } };
  } catch {
    return { success: false, error: "Could not configure GitHub updates. The project token needs Webhooks: Read and write, and its GitHub account must be allowed to manage repository webhooks. Update the token and retry." };
  }
}

export async function retryGitHubUpdatesAction(input: z.infer<typeof githubProjectSchema>): Promise<Result> {
  const parsed = githubProjectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid project." };
  try {
    const { projectId } = parsed.data;
    await authorize(projectId);
    const { processGitHubDelivery } = await import("@/lib/github-webhooks");
    const deliveries = await prisma.gitHubWebhookDelivery.findMany({ where: { projectId, processedAt: null }, orderBy: { receivedAt: "asc" }, take: 5, select: { deliveryId: true } });
    for (const delivery of deliveries) await processGitHubDelivery(projectId, delivery.deliveryId);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: { message: "Incoming GitHub updates retried. Check the incoming status below for any remaining problems." } };
  } catch { return { success: false, error: "Could not retry incoming updates. Check your project permissions and connection." }; }
}
