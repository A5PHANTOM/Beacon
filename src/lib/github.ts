import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeIssueHistory } from "@/lib/history";

import { githubRequest, decryptGitHubToken } from "./github-api";
import { getAssignableDevelopers } from "./project-assignees";
export { encryptGitHubToken, githubRequest } from "./github-api";

// Names are labels, not Markdown or GitHub mentions supplied by a user.
function attributionName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 160).replace(/[\\`*_{}[\]()<>!#|@]/g, "\\$&");
}

const remoteIssue = z.object({ number: z.number().int().positive(), body: z.string().nullable().optional(), pull_request: z.unknown().optional() });

// Called only after an authorized local mutation, or by the authorized retry action.
// A durable per-issue lease prevents concurrent creation; markers recover an API success
// followed by a failed local commit without creating another remote issue/comment.
export async function syncIssueToGitHub(issueId: string, userId: string) {
  let issue = await prisma.issue.findUnique({ where: { id: issueId }, include: { project: { include: { github: true } }, assignee: { select: { name: true } }, reporter: { select: { name: true } } } });
  const connection = issue?.project.github;
  if (!issue || !connection?.enabled) return;
  await prisma.gitHubIssueSync.upsert({ where: { issueId }, create: { issueId }, update: {} });
  const now = new Date();
  const lease = new Date(now.getTime() + 300000);
  const claimed = await prisma.gitHubIssueSync.updateMany({ where: { issueId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, data: { lockedUntil: lease } });
  if (!claimed.count) return;
  try {
    // Read after acquiring the lease, so a waiting mutation cannot sync an older snapshot.
    const current = await prisma.$transaction(async tx => {
      const snapshot = await tx.issue.findUniqueOrThrow({ where: { id: issueId }, include: { project: { include: { github: true } }, assignee: { select: { name: true } }, reporter: { select: { name: true } } } });
      const assignment = await tx.issueHistory.findFirst({ where: { issueId, fieldChanged: "assignee" }, orderBy: [{ changedAt: "desc" }, { id: "desc" }], select: { id: true, user: { select: { name: true } } } });
      return { issue: snapshot, assignment };
    }, { isolationLevel: "Serializable" });
    issue = current.issue;
    const assignment = current.assignment;
    const reportedBy = attributionName(issue.reporter.name);
    const assignedBy = attributionName(assignment?.user.name ?? issue.reporter.name);
    const assignmentAction = issue.assigneeId ? "Assigned by" : "Unassigned by";
    const actorLine = issue.assigneeId || assignment ? `**${assignmentAction}:** ${assignedBy} (Beacon)` : null;
    const token = decryptGitHubToken(connection.encryptedToken);
    const base = `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`;
    const sync = await prisma.gitHubIssueSync.findUniqueOrThrow({ where: { issueId } });
    const marker = `<!-- beacon-issue:${issue.id} -->`;
    let number = sync.number;
    const title = `[${issue.project.key}-${issue.number}] ${issue.title}`;
    const body = [marker, [`**Reported by:** ${reportedBy} (Beacon)`, `**Assigned to:** ${issue.assignee ? attributionName(issue.assignee.name) : "Unassigned"}`, actorLine].filter(Boolean).join("\n"), issue.description, issue.stepsToReproduce && `### Steps to reproduce\n${issue.stepsToReproduce}`, issue.expected && `### Expected\n${issue.expected}`, issue.actual && `### Actual\n${issue.actual}`, `Beacon status: ${issue.status}\nPriority: ${issue.priority}\nSeverity: ${issue.severity}`, issue.environment && `Environment: ${issue.environment}`].filter(Boolean).join("\n\n");
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
    let assignmentError: string | null = null;
    let githubAssignee: { githubId: string | null; githubLogin: string | null } | null = null;
    if (issue.assigneeId) {
      try {
        const eligible = await getAssignableDevelopers(issue.projectId);
        githubAssignee = eligible.developers.find(user => user.userId === issue!.assigneeId) ?? null;
        if (!githubAssignee?.githubId || !githubAssignee.githubLogin) assignmentError = "GitHub assignment pending: the Beacon developer must sign in with GitHub and have access to this repository.";
      } catch { assignmentError = "GitHub assignment pending: could not verify repository access. Check the connection and retry."; }
    }
    const patched = await githubRequest(token, `${base}/issues/${number}`, "PATCH", {
      title, body, state: issue.status === "CLOSED" ? "closed" : "open",
      ...(!assignmentError ? { assignees: githubAssignee?.githubLogin ? [githubAssignee.githubLogin] : [] } : {}),
    });
    if (!assignmentError) {
      // GitHub can silently ignore assignees. A 2xx response alone is not success.
      const actual = z.object({ assignees: z.array(z.object({ id: z.number().int().positive() })) }).parse(patched).assignees;
      const expected = githubAssignee?.githubId ?? null;
      if (expected ? actual.length !== 1 || String(actual[0].id) !== expected : actual.length !== 0) {
        assignmentError = "GitHub did not apply the requested assignee. Check the connection token's write access and retry.";
      }
    }
    const snapshot = issue.assigneeId ?? "unassigned";
    const assignmentSnapshot = `${snapshot}:${assignment?.id ?? "created"}`;
    if (sync.assigneeSnapshot !== assignmentSnapshot) {
      const assignmentMarker = `<!-- beacon-assignee:${issue.id}:${snapshot}:${assignment?.id ?? "created"} -->`;
      let exists = false;
      for (let page = 1; page <= 5; page++) {
        const comments = z.array(z.object({ body: z.string() })).parse(await githubRequest(token, `${base}/issues/${number}/comments?per_page=100&page=${page}`));
        exists = comments.some(c => c.body.includes(assignmentMarker));
        if (exists || comments.length < 100) break;
        if (page === 5) throw new Error("Too many GitHub comments to safely recover assignment sync.");
      }
      if (!exists) await githubRequest(token, `${base}/issues/${number}/comments`, "POST", {
        body: [assignmentMarker, issue.assignee ? `Assigned in Beacon: ${attributionName(issue.assignee.name)}.` : "Unassigned in Beacon.", actorLine, `**Reported by:** ${reportedBy} (Beacon)`].filter(Boolean).join("\n"),
      });
    }
    const syncedIssue = issue;
    await prisma.$transaction(async tx => {
      const githubAssigneeId = githubAssignee?.githubId ?? null;
      if (!assignmentError && githubAssigneeId !== sync.githubAssigneeId) {
        await writeIssueHistory(tx, issueId, userId, { fieldChanged: "github_assignee", oldValue: sync.githubAssigneeId, newValue: githubAssignee?.githubLogin ?? "Unassigned" });
      }
      await tx.gitHubIssueSync.update({ where: { issueId }, data: {
        assigneeSnapshot: assignmentSnapshot, assignmentSynced: !assignmentError, lastError: assignmentError,
        ...(!assignmentError ? { githubAssigneeId, syncedAt: syncedIssue.updatedAt } : {}),
      } });
    });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("GitHub") ? error.message : "GitHub sync failed. Check connection settings and retry.";
    await prisma.gitHubIssueSync.update({ where: { issueId }, data: { lastError: message, assignmentSynced: false } });
  } finally {
    await prisma.gitHubIssueSync.updateMany({ where: { issueId, lockedUntil: lease }, data: { lockedUntil: null } });
  }
}

// Local changes remain successful when GitHub is unavailable. A missing/stale sync
// is visible on the project page and can be retried without repeating the mutation.
export async function attemptGitHubSync(issueId: string, userId: string) {
  try {
    await syncIssueToGitHub(issueId, userId);
    const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { updatedAt: true, project: { select: { github: { select: { enabled: true } } } }, githubSync: true } });
    if (!issue?.project.github?.enabled) return undefined;
    const sync = issue.githubSync;
    if (!sync?.assignmentSynced || sync.lastError || !sync.syncedAt || sync.syncedAt < issue.updatedAt) {
      return "Saved in Beacon. GitHub sync is pending; check the project connection and use Sync pending to retry.";
    }
    return undefined;
  } catch {
    console.error("GitHub sync could not be persisted", { issueId });
    return "Saved in Beacon. GitHub sync could not finish; please retry from the connection panel.";
  }
}
