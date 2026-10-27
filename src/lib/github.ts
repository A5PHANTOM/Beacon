import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeIssueHistory } from "@/lib/history";

function encryptionKey() {
  const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("Configure GITHUB_TOKEN_ENCRYPTION_KEY before connecting GitHub.");
  return Buffer.from(key, "hex");
}
export function encryptGitHubToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString("base64")).join(".");
}
function decryptToken(value: string) {
  const [iv, tag, data] = value.split(".").map(v => Buffer.from(v, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
export async function githubRequest(token: string, path: string, method = "GET", body?: unknown): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error",
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("GitHub token expired or is invalid. Update the connection.");
    if (response.status === 403 || response.status === 429) throw new Error("GitHub denied access or rate limited the request. Check Issues write permission and retry later.");
    if (response.status === 404) throw new Error("GitHub repository or issue is unavailable. Check repository access.");
    throw new Error(`GitHub request failed (${response.status}). Retry sync later.`);
  }
  return response.json();
}
const remoteIssue = z.object({ number: z.number().int().positive(), body: z.string().nullable().optional(), pull_request: z.unknown().optional() });

// Called only after an authorized local mutation, or by the authorized retry action.
// A durable per-issue lease prevents concurrent creation; markers recover an API success
// followed by a failed local commit without creating another remote issue/comment.
export async function syncIssueToGitHub(issueId: string, userId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, include: { project: { include: { github: true } }, assignee: { select: { name: true } } } });
  const connection = issue?.project.github;
  if (!issue || !connection?.enabled) return;
  await prisma.gitHubIssueSync.upsert({ where: { issueId }, create: { issueId }, update: {} });
  const now = new Date();
  const lease = new Date(now.getTime() + 300000);
  const claimed = await prisma.gitHubIssueSync.updateMany({ where: { issueId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, data: { lockedUntil: lease } });
  if (!claimed.count) return;
  try {
    const token = decryptToken(connection.encryptedToken);
    const base = `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`;
    const sync = await prisma.gitHubIssueSync.findUniqueOrThrow({ where: { issueId } });
    const marker = `<!-- beacon-issue:${issue.id} -->`;
    let number = sync.number;
    const title = `[${issue.project.key}-${issue.number}] ${issue.title}`;
    const body = [marker, issue.description, issue.stepsToReproduce && `### Steps to reproduce\n${issue.stepsToReproduce}`, issue.expected && `### Expected\n${issue.expected}`, issue.actual && `### Actual\n${issue.actual}`, `Beacon status: ${issue.status}\nPriority: ${issue.priority}\nSeverity: ${issue.severity}`, issue.environment && `Environment: ${issue.environment}`].filter(Boolean).join("\n\n");
    if (!number) {
      // Pagination is bounded for serverless runtime; refuse to create if recovery is incomplete.
      for (let page = 1; page <= 5; page++) {
        const rows = z.array(remoteIssue).parse(await githubRequest(token, `${base}/issues?state=all&sort=created&direction=desc&since=${encodeURIComponent(new Date(issue.createdAt.getTime() - 60000).toISOString())}&per_page=100&page=${page}`));
        number = rows.find(row => !row.pull_request && row.body?.includes(marker))?.number ?? null;
        if (number || rows.length < 100) break;
        if (page === 5) throw new Error("Repository is too busy to safely recover this issue. Retry later.");
      }
      if (!number) number = remoteIssue.parse(await githubRequest(token, `${base}/issues`, "POST", { title, body })).number;
      await prisma.$transaction(async tx => {
        await tx.gitHubIssueSync.update({ where: { issueId }, data: { number } });
        await writeIssueHistory(tx, issueId, userId, { fieldChanged: "github", newValue: `${connection.owner}/${connection.repo}#${number}` });
      });
    }
    await githubRequest(token, `${base}/issues/${number}`, "PATCH", { title, body, state: issue.status === "CLOSED" ? "closed" : "open" });
    const snapshot = issue.assigneeId ?? "unassigned";
    if (sync.assigneeSnapshot !== snapshot) {
      const assignment = await prisma.issueHistory.findFirst({ where: { issueId, fieldChanged: "assignee" }, orderBy: [{ changedAt: "desc" }, { id: "desc" }], select: { id: true } });
      const assignmentMarker = `<!-- beacon-assignee:${issue.id}:${snapshot}:${assignment?.id ?? "created"} -->`;
      let exists = false;
      for (let page = 1; page <= 5; page++) {
        const comments = z.array(z.object({ body: z.string() })).parse(await githubRequest(token, `${base}/issues/${number}/comments?per_page=100&page=${page}`));
        exists = comments.some(c => c.body.includes(assignmentMarker));
        if (exists || comments.length < 100) break;
        if (page === 5) throw new Error("Too many GitHub comments to safely recover assignment sync.");
      }
      if (!exists) await githubRequest(token, `${base}/issues/${number}/comments`, "POST", { body: `${assignmentMarker}\nAssigned in Beacon: ${issue.assignee?.name ?? "Unassigned"}.` });
    }
    await prisma.gitHubIssueSync.update({ where: { issueId }, data: { assigneeSnapshot: snapshot, lastError: null, syncedAt: issue.updatedAt } });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("GitHub") ? error.message : "GitHub sync failed. Check connection settings and retry.";
    await prisma.gitHubIssueSync.update({ where: { issueId }, data: { lastError: message } });
  } finally {
    await prisma.gitHubIssueSync.updateMany({ where: { issueId, lockedUntil: lease }, data: { lockedUntil: null } });
  }
}

// Local changes remain successful when GitHub is unavailable. A missing/stale sync
// is visible on the project page and can be retried without repeating the mutation.
export async function attemptGitHubSync(issueId: string, userId: string) {
  try { await syncIssueToGitHub(issueId, userId); } catch { console.error("GitHub sync could not be persisted", { issueId }); }
}
