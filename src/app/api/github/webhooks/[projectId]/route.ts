import { z } from "zod";
import { prisma } from "@/lib/db";
import { decryptGitHubToken } from "@/lib/github-api";
import { githubIssueEventSchema, processGitHubDelivery, verifyGitHubSignature, webhookPayloadHash } from "@/lib/github-webhooks";

export const runtime = "nodejs";
export const maxDuration = 60;
const limit = 1024 * 1024;
const deliveryIdSchema = z.string().uuid();

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const params = z.object({ projectId: z.string().min(1).max(100) }).safeParse(await context.params);
    if (!params.success) return Response.json({ error: "Invalid webhook." }, { status: 400 });
    const { projectId } = params.data;
    const connection = await prisma.gitHubConnection.findUnique({ where: { projectId } });
    if (!connection?.encryptedWebhookSecret || !connection.githubRepositoryId) return Response.json({ error: "Invalid webhook." }, { status: 401 });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    if (reader) while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { await reader.cancel(); return Response.json({ error: "Payload too large." }, { status: 413 }); }
      chunks.push(chunk.value);
    }
    const body = Buffer.concat(chunks);
    if (!verifyGitHubSignature(body, request.headers.get("x-hub-signature-256"), decryptGitHubToken(connection.encryptedWebhookSecret))) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
    let payload: unknown;
    try { payload = JSON.parse(body.toString("utf8")); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
    const event = request.headers.get("x-github-event");
    if (event === "ping") {
      const ping = z.object({ repository: z.object({ id: z.number().int().positive() }) }).safeParse(payload);
      if (!ping.success || String(ping.data.repository.id) !== connection.githubRepositoryId) return Response.json({ error: "Repository mismatch." }, { status: 403 });
      return Response.json({ received: true });
    }
    if (event !== "issues") return Response.json({ ignored: true });
    const action = z.object({ action: z.string() }).safeParse(payload);
    if (!action.success) return Response.json({ error: "Invalid event." }, { status: 400 });
    if (!["reopened", "closed"].includes(action.data.action)) return Response.json({ ignored: true });
    if (!connection.enabled || !connection.inboundEnabled) return Response.json({ ignored: true, reason: "paused" });
    if (request.headers.get("x-github-hook-id") !== String(connection.webhookId)) return Response.json({ error: "Webhook mismatch." }, { status: 403 });
    const parsed = githubIssueEventSchema.safeParse(payload);
    const deliveryId = deliveryIdSchema.safeParse(request.headers.get("x-github-delivery"));
    if (!parsed.success || !deliveryId.success) return Response.json({ error: "Invalid issue event." }, { status: 400 });
    const data = parsed.data;
    if (String(data.repository.id) !== connection.githubRepositoryId) return Response.json({ error: "Repository mismatch." }, { status: 403 });
    if (data.issue.pull_request || data.issue.state !== (data.action === "reopened" ? "open" : "closed")) return Response.json({ ignored: true, reason: "unsupported_issue" });
    // Match the persisted link, never a client-provided Beacon issue ID or body marker.
    const links = await prisma.gitHubIssueSync.findMany({ where: { number: data.issue.number, issue: { projectId } }, take: 2, select: { issueId: true } });
    if (links.length !== 1) return Response.json({ ignored: true, reason: "unlinked_or_ambiguous" });
    const key = { projectId_deliveryId: { projectId, deliveryId: deliveryId.data } };
    const hash = webhookPayloadHash(body);
    const previous = await prisma.gitHubWebhookDelivery.findUnique({ where: key });
    if (previous && previous.payloadHash !== hash) return Response.json({ error: "Delivery ID mismatch." }, { status: 409 });
    if (previous) {
      const result = await processGitHubDelivery(projectId, deliveryId.data);
      return Response.json(result, { status: result.status === "failed" ? 503 : result.status === "queued" ? 202 : 200 });
    }
    try {
      await prisma.gitHubWebhookDelivery.create({ data: { projectId, deliveryId: deliveryId.data, issueId: links[0].issueId, issueNumber: data.issue.number, remoteIssueId: String(data.issue.id), senderGitHubId: String(data.sender.id), senderLogin: data.sender.login, action: data.action, remoteState: data.issue.state, remoteUpdatedAt: new Date(data.issue.updated_at), payloadHash: hash } });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
      const existing = await prisma.gitHubWebhookDelivery.findUnique({ where: key });
      if (!existing || existing.payloadHash !== hash) return Response.json({ error: "Delivery ID mismatch." }, { status: 409 });
    }
    const result = await processGitHubDelivery(projectId, deliveryId.data);
    return Response.json(result, { status: result.status === "failed" ? 503 : result.status === "queued" ? 202 : 200 });
  } catch {
    return Response.json({ error: "Could not process webhook. Redeliver or retry from the project connection." }, { status: 503 });
  }
}
