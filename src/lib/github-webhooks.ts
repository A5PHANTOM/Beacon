import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "./db";
import { decryptGitHubToken, githubRequest } from "./github-api";
import { writeIssueHistory } from "./history";
import { can } from "./permissions";
import type { GlobalRole, ProjectRole } from "./types";
import { canTransition, githubInboundStatusTarget } from "./workflow";
import { revalidatePath } from "next/cache";

export const githubIssueEventSchema = z.object({
  action: z.enum(["reopened", "closed"]),
  repository: z.object({ id: z.number().int().positive() }),
  issue: z.object({ id: z.number().int().positive(), number: z.number().int().positive(), state: z.enum(["open", "closed"]), updated_at: z.string().datetime(), pull_request: z.unknown().optional() }),
  sender: z.object({ id: z.number().int().positive(), login: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-]+(?:\[bot\])?$/) }),
});
export function verifyGitHubSignature(body: Buffer, signature: string | null, secret: string) {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function webhookPayloadHash(body: Buffer) { return createHash("sha256").update(body).digest("hex"); }

type Outcome = { status: "applied" | "ignored" | "queued" | "failed"; reason?: string };
const remoteSchema = z.object({ id: z.number().int().positive(), number: z.number().int().positive(), state: z.enum(["open", "closed"]), updated_at: z.string().datetime(), pull_request: z.unknown().optional() });
const remoteState = (status: string) => status === "CLOSED" ? "closed" : "open";

export async function processGitHubDelivery(projectId: string, deliveryId: string): Promise<Outcome> {
  const key = { projectId_deliveryId: { projectId, deliveryId } };
  const delivery = await prisma.gitHubWebhookDelivery.findUnique({ where: key });
  if (!delivery || delivery.processedAt) return { status: "ignored", reason: "already_processed" };
  const sync = await prisma.gitHubIssueSync.findUnique({ where: { issueId: delivery.issueId } });
  if (!sync) return { status: "ignored", reason: "unlinked" };
  const lease = new Date(Date.now() + 300000);
  const claimed = await prisma.gitHubIssueSync.updateMany({ where: { issueId: delivery.issueId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] }, data: { lockedUntil: lease } });
  if (!claimed.count) return { status: "queued", reason: "sync_in_progress" };
  try {
    const connection = await prisma.gitHubConnection.findUnique({ where: { projectId } });
    if (!connection?.enabled || !connection.inboundEnabled) return { status: "queued", reason: "sync_paused" };
    // Recheck authorization before using the project token. The sender must still
    // be linked to an authorized Beacon account, including on later retries.
    const actor = await prisma.user.findUnique({ where: { githubId: delivery.senderGitHubId }, select: { id: true, role: true } });
    const member = actor ? await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: actor.id } } }) : null;
    const authorized = actor && can((member?.roleInProject ?? "VIEWER") as ProjectRole, "issue:update", actor.role as GlobalRole);
    if (!authorized) {
      await prisma.gitHubWebhookDelivery.update({ where: key, data: { processedAt: new Date(), result: "forbidden", lastError: "Sender is not an authorized Beacon project member." } });
      await prisma.gitHubConnection.update({ where: { projectId }, data: { lastWebhookError: "A GitHub status change was ignored: the sender must sign in to Beacon with GitHub and have permission to update this project." } });
      return { status: "ignored", reason: "forbidden" };
    }
    const current = remoteSchema.parse(await githubRequest(decryptGitHubToken(connection.encryptedToken), `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/issues/${delivery.issueNumber}`, "GET", undefined, 5000));
    // GitHub can deliver/replay events out of order. Inspect the live issue instead
    // of trusting an old payload, including the immutable remote issue ID.
    const stale = String(current.id) !== delivery.remoteIssueId || current.number !== delivery.issueNumber || !!current.pull_request || current.state !== delivery.remoteState;
    if (stale) {
      await prisma.gitHubWebhookDelivery.update({ where: key, data: { processedAt: new Date(), result: "stale", lastError: null } });
      await prisma.gitHubConnection.update({ where: { projectId }, data: { lastWebhookAt: new Date(), lastWebhookError: null } });
      return { status: "ignored", reason: "stale" };
    }
    if (new Date(current.updated_at) < delivery.remoteUpdatedAt) throw new Error("Remote state is not current yet");
    const outcome = await prisma.$transaction(async tx => {
      const receipt = await tx.gitHubWebhookDelivery.findUniqueOrThrow({ where: key });
      if (receipt.processedAt) return { status: "ignored", reason: "already_processed" } as Outcome;
      const issue = await tx.issue.findUnique({ where: { id: delivery.issueId }, include: { githubSync: true } });
      const activeConnection = await tx.gitHubConnection.findUnique({ where: { projectId } });
      const freshActor = await tx.user.findUnique({ where: { githubId: delivery.senderGitHubId }, select: { id: true, role: true } });
      const freshMember = freshActor ? await tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: freshActor.id } } }) : null;
      if (!issue || issue.projectId !== projectId || issue.githubSync?.number !== delivery.issueNumber || !activeConnection?.enabled || !activeConnection.inboundEnabled || activeConnection.githubRepositoryId !== connection.githubRepositoryId || !freshActor || !can((freshMember?.roleInProject ?? "VIEWER") as ProjectRole, "issue:update", freshActor.role as GlobalRole)) {
        await tx.gitHubWebhookDelivery.update({ where: key, data: { processedAt: new Date(), result: "access_changed" } });
        return { status: "ignored", reason: "access_changed" } as Outcome;
      }
      const target = githubInboundStatusTarget(delivery.action as "reopened" | "closed", issue.status);
      const confirmed = issue.githubSync.lastConfirmedStatus;
      if (target && confirmed && remoteState(confirmed) !== remoteState(issue.status)) {
        await tx.gitHubWebhookDelivery.update({ where: key, data: { lastError: "Waiting for a pending Beacon status change to sync." } });
        return { status: "queued", reason: "pending_beacon_status" } as Outcome;
      }
      if (target && !canTransition(issue.status, target)) {
        const message = `Beacon workflow does not allow ${issue.status} → ${target}. Update the issue through its workflow, then retry.`;
        await tx.gitHubWebhookDelivery.update({ where: key, data: { lastError: message } });
        await tx.gitHubConnection.update({ where: { projectId }, data: { lastWebhookError: message } });
        return { status: "queued", reason: "workflow" } as Outcome;
      }
      if (target) {
        await tx.issue.update({ where: { id: issue.id }, data: { status: target } });
        await writeIssueHistory(tx, issue.id, freshActor.id, { fieldChanged: "status", oldValue: issue.status, newValue: target });
        await tx.comment.create({ data: { issueId: issue.id, userId: freshActor.id, body: `[GitHub] Issue ${delivery.action} by @${delivery.senderLogin}. Beacon status: ${target.replaceAll("_", " ")}.` } });
      }
      await tx.gitHubIssueSync.update({ where: { issueId: issue.id }, data: { lastConfirmedStatus: target ?? issue.status } });
      await tx.gitHubWebhookDelivery.update({ where: key, data: { processedAt: new Date(), result: target ? "applied" : "echo", lastError: null } });
      await tx.gitHubConnection.update({ where: { projectId }, data: { lastWebhookAt: new Date(), lastWebhookError: null } });
      return { status: target ? "applied" : "ignored", reason: target ? undefined : "echo" } as Outcome;
    }, { isolationLevel: "Serializable" });
    if (outcome.status === "applied") revalidatePath(`/projects/${projectId}`);
    return outcome;
  } catch {
    const message = "GitHub status update is pending. Check the connection and retry incoming updates.";
    await prisma.gitHubWebhookDelivery.updateMany({ where: { projectId, deliveryId, processedAt: null }, data: { lastError: message } });
    await prisma.gitHubConnection.updateMany({ where: { projectId }, data: { lastWebhookError: message } });
    return { status: "failed", reason: "retry_required" };
  } finally {
    await prisma.gitHubIssueSync.updateMany({ where: { issueId: delivery.issueId, lockedUntil: lease }, data: { lockedUntil: null } });
  }
}

export async function drainGitHubDeliveries(issueId: string) {
  const pending = await prisma.gitHubWebhookDelivery.findMany({ where: { issueId, processedAt: null }, orderBy: { receivedAt: "asc" }, take: 5, select: { projectId: true, deliveryId: true } });
  for (const delivery of pending) {
    const result = await processGitHubDelivery(delivery.projectId, delivery.deliveryId);
    if (result.status === "queued" || result.status === "failed") break;
  }
}
