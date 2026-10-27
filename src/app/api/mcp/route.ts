import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canTransition, type IssueStatus } from "@/lib/workflow";
import { writeIssueHistory } from "@/lib/history";
import { z } from "zod";
import { attemptGitHubSync } from "@/lib/github";
import { can } from "@/lib/permissions";
import type { GlobalRole, ProjectRole } from "@/lib/types";

export const dynamic = "force-dynamic";

function authenticateRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("x-beacon-api-key");
  const expectedKey =
    process.env.BEACON_API_KEY;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : apiKeyHeader?.trim();

  return Boolean(expectedKey && token && token === expectedKey);
}

async function resolveActorUser(req: NextRequest) {
  const userEmail = req.headers.get("x-beacon-user-email");
  const userId = req.headers.get("x-beacon-user-id");

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return user;
  }

  if (userEmail) {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (user) return user;
  }

  // Fallback to primary admin or system user
  const admin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: "admin@gmail.com" },
        { role: "ADMIN" },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (admin) return admin;

  // Fallback to any existing user
  const anyUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (anyUser) return anyUser;

  // Auto-bootstrap system integration user if database is completely empty
  return prisma.user.create({
    data: {
      email: "antigravity-bot@beacon.local",
      name: "Antigravity MCP Bot",
      passwordHash: "system-managed-token-no-login",
      role: "ADMIN",
    },
  });
}

// -------------------------------------------------------------
// GET Handler: Read Operations
// -------------------------------------------------------------
export async function GET(req: NextRequest) {
  if (!authenticateRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing API key." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "projects": {
        const rawProjects = await prisma.project.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { issues: true, members: true },
            },
            issues: {
              select: { id: true, status: true },
            },
          },
        });

        const projects = rawProjects.map((p) => {
          const resolvedCount = p.issues.filter((i) =>
            [
              "FIXED",
              "VERIFIED",
              "CLOSED",
              "DEV_COMPLETED",
              "DEV_DEPLOYED",
              "QA_DEPLOYED",
              "PROD_DEPLOYED",
              "REJECTED",
              "INVALID",
            ].includes(i.status)
          ).length;

          const openCount = Math.max(0, p._count.issues - resolvedCount);

          return {
            id: p.id,
            name: p.name,
            key: p.key,
            description: p.description,
            totalIssuesCount: p._count.issues,
            openIssuesCount: openCount,
            membersCount: p._count.members,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          };
        });

        return NextResponse.json({ success: true, projects });
      }

      case "issues": {
        const projectIdParam = searchParams.get("projectId");
        const statusParam = searchParams.get("status");
        const severityParam = searchParams.get("severity");
        const priorityParam = searchParams.get("priority");
        const limitParam = parseInt(searchParams.get("limit") || "50", 10);

        const whereClause: Record<string, unknown> = {};

        if (projectIdParam) {
          whereClause.OR = [
            { projectId: projectIdParam },
            { project: { key: projectIdParam.toUpperCase() } },
          ];
        }

        if (statusParam) {
          whereClause.status = statusParam;
        }

        if (severityParam) {
          whereClause.severity = severityParam;
        }

        if (priorityParam) {
          whereClause.priority = priorityParam;
        }

        const issues = await prisma.issue.findMany({
          where: whereClause,
          take: Math.min(Math.max(1, limitParam), 100),
          orderBy: { number: "desc" },
          include: {
            project: {
              select: { id: true, key: true, name: true },
            },
            reporter: {
              select: { id: true, name: true, email: true },
            },
            assignee: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: { comments: true, attachments: true },
            },
          },
        });

        return NextResponse.json({
          success: true,
          count: issues.length,
          issues: issues.map((i) => ({
            id: i.id,
            key: `${i.project.key}-${i.number}`,
            number: i.number,
            title: i.title,
            status: i.status,
            severity: i.severity,
            priority: i.priority,
            projectId: i.projectId,
            projectName: i.project.name,
            projectKey: i.project.key,
            assignee: i.assignee ? { name: i.assignee.name, email: i.assignee.email } : null,
            reporter: { name: i.reporter.name, email: i.reporter.email },
            commentsCount: i._count.comments,
            attachmentsCount: i._count.attachments,
            createdAt: i.createdAt.toISOString(),
            updatedAt: i.updatedAt.toISOString(),
          })),
        });
      }

      case "issue": {
        const issueId = searchParams.get("issueId");
        const projectKey = searchParams.get("projectKey");
        const issueNumberStr = searchParams.get("issueNumber");

        let issue = null;

        if (issueId) {
          issue = await prisma.issue.findUnique({
            where: { id: issueId },
            include: {
              project: {
                select: { id: true, key: true, name: true },
              },
              reporter: {
                select: { id: true, name: true, email: true },
              },
              assignee: {
                select: { id: true, name: true, email: true },
              },
              comments: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: "asc" },
              },
              attachments: {
                orderBy: { uploadedAt: "desc" },
              },
              history: {
                include: {
                  user: { select: { id: true, name: true } },
                },
                orderBy: { changedAt: "desc" },
              },
            },
          });
        } else if (projectKey && issueNumberStr) {
          const number = parseInt(issueNumberStr, 10);
          const project = await prisma.project.findFirst({
            where: {
              OR: [
                { id: projectKey },
                { key: projectKey.toUpperCase() },
              ],
            },
            select: { id: true },
          });

          if (project) {
            issue = await prisma.issue.findUnique({
              where: {
                projectId_number: {
                  projectId: project.id,
                  number,
                },
              },
              include: {
                project: {
                  select: { id: true, key: true, name: true },
                },
                reporter: {
                  select: { id: true, name: true, email: true },
                },
                assignee: {
                  select: { id: true, name: true, email: true },
                },
                comments: {
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                  },
                  orderBy: { createdAt: "asc" },
                },
                attachments: {
                  orderBy: { uploadedAt: "desc" },
                },
                history: {
                  include: {
                    user: { select: { id: true, name: true } },
                  },
                  orderBy: { changedAt: "desc" },
                },
              },
            });
          }
        }

        if (!issue) {
          return NextResponse.json(
            { error: "Issue not found." },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          issue: {
            id: issue.id,
            key: `${issue.project.key}-${issue.number}`,
            number: issue.number,
            title: issue.title,
            description: issue.description,
            stepsToReproduce: issue.stepsToReproduce,
            expected: issue.expected,
            actual: issue.actual,
            environment: issue.environment,
            status: issue.status,
            severity: issue.severity,
            priority: issue.priority,
            project: issue.project,
            reporter: issue.reporter,
            assignee: issue.assignee,
            comments: issue.comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: c.createdAt.toISOString(),
              user: c.user,
            })),
            attachments: issue.attachments.map((a) => ({
              id: a.id,
              filename: a.filename,
              fileUrl: a.fileUrl,
              size: a.size,
              uploadedAt: a.uploadedAt.toISOString(),
            })),
            history: issue.history.map((h) => ({
              id: h.id,
              fieldChanged: h.fieldChanged,
              oldValue: h.oldValue,
              newValue: h.newValue,
              changedAt: h.changedAt.toISOString(),
              userName: h.user.name,
            })),
            createdAt: issue.createdAt.toISOString(),
            updatedAt: issue.updatedAt.toISOString(),
          },
        });
      }

      case "search": {
        const query = searchParams.get("query")?.trim();
        const projectIdParam = searchParams.get("projectId");
        const limitParam = parseInt(searchParams.get("limit") || "20", 10);

        if (!query) {
          return NextResponse.json(
            { error: "Search query is required." },
            { status: 400 }
          );
        }

        const projectCondition = projectIdParam
          ? {
              OR: [
                { projectId: projectIdParam },
                { project: { key: projectIdParam.toUpperCase() } },
              ],
            }
          : {};

        const results = await prisma.issue.findMany({
          where: {
            AND: [
              projectCondition,
              {
                OR: [
                  { title: { contains: query } },
                  { description: { contains: query } },
                  { stepsToReproduce: { contains: query } },
                ],
              },
            ],
          },
          take: Math.min(Math.max(1, limitParam), 50),
          orderBy: { updatedAt: "desc" },
          include: {
            project: { select: { id: true, key: true, name: true } },
            assignee: { select: { name: true } },
          },
        });

        return NextResponse.json({
          success: true,
          count: results.length,
          results: results.map((r) => ({
            id: r.id,
            key: `${r.project.key}-${r.number}`,
            number: r.number,
            title: r.title,
            status: r.status,
            severity: r.severity,
            priority: r.priority,
            projectKey: r.project.key,
            projectName: r.project.name,
            assigneeName: r.assignee?.name || "Unassigned",
            updatedAt: r.updatedAt.toISOString(),
          })),
        });
      }

      case "attachments": {
        const issueId = searchParams.get("issueId");
        if (!issueId) {
          return NextResponse.json(
            { error: "issueId parameter is required." },
            { status: 400 }
          );
        }

        const attachments = await prisma.attachment.findMany({
          where: { issueId },
          orderBy: { uploadedAt: "desc" },
        });

        return NextResponse.json({
          success: true,
          count: attachments.length,
          attachments: attachments.map((a) => ({
            id: a.id,
            issueId: a.issueId,
            filename: a.filename,
            fileUrl: a.fileUrl,
            size: a.size,
            uploadedAt: a.uploadedAt.toISOString(),
          })),
        });
      }

      default:
        return NextResponse.json(
          {
            error:
              "Unknown or missing action. Valid actions: projects, issues, issue, search, attachments",
          },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// -------------------------------------------------------------
// POST Handler: Controlled Mutations
// -------------------------------------------------------------
const updateStatusSchema = z.object({
  action: z.literal("update_status"),
  issueId: z.string().min(1, "issueId is required"),
  status: z.string().min(1, "new status is required"),
  notes: z.string().optional(),
});

const attachFixSummarySchema = z.object({
  action: z.literal("attach_fix_summary"),
  issueId: z.string().min(1, "issueId is required"),
  summary: z.string().min(3, "Summary must be at least 3 characters"),
  updateStatusTo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!authenticateRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing API key." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const actorUser = await resolveActorUser(req);

    if (body.action === "update_status") {
      const parsed = updateStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Invalid status update data" },
          { status: 400 }
        );
      }

      const { issueId, status: newStatus, notes } = parsed.data;

      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        include: { project: true },
      });

      if (!issue) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      }
      const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: issue.projectId, userId: actorUser.id } } });
      if (!can((membership?.roleInProject ?? "VIEWER") as ProjectRole, "issue:update", actorUser.role as GlobalRole)) {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }

      // Check state machine transition
      if (!canTransition(issue.status as IssueStatus, newStatus)) {
        return NextResponse.json(
          {
            error: `Invalid transition: cannot transition status from ${issue.status} to ${newStatus}`,
          },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.issue.update({
          where: { id: issueId },
          data: { status: newStatus },
        });

        await writeIssueHistory(tx, issueId, actorUser.id, {
          fieldChanged: "status",
          oldValue: issue.status,
          newValue: newStatus,
        });

        if (notes && notes.trim()) {
          await tx.comment.create({
            data: {
              issueId,
              userId: actorUser.id,
              body: `[Status updated via MCP to ${newStatus}]\n${notes.trim()}`,
            },
          });
        }
      });

      const warning = await attemptGitHubSync(issue.id, actorUser.id);
      return NextResponse.json({
        success: true,
        warning,
        issueId,
        previousStatus: issue.status,
        newStatus,
      });
    }

    if (body.action === "attach_fix_summary") {
      const parsed = attachFixSummarySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Invalid fix summary payload" },
          { status: 400 }
        );
      }

      const { issueId, summary, updateStatusTo } = parsed.data;

      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        include: { project: true },
      });

      if (!issue) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      }
      const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: issue.projectId, userId: actorUser.id } } });
      if (!can((membership?.roleInProject ?? "VIEWER") as ProjectRole, "issue:update", actorUser.role as GlobalRole)) {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }

      let finalStatus = issue.status;

      if (updateStatusTo && updateStatusTo !== issue.status) {
        if (!canTransition(issue.status as IssueStatus, updateStatusTo)) {
          return NextResponse.json(
            {
              error: `Invalid transition: cannot update status from ${issue.status} to ${updateStatusTo}`,
            },
            { status: 400 }
          );
        }
        finalStatus = updateStatusTo;
      }

      const comment = await prisma.$transaction(async (tx) => {
        const commentRecord = await tx.comment.create({
          data: {
            issueId,
            userId: actorUser.id,
            body: `### 🤖 Antigravity Fix Summary\n\n${summary.trim()}`,
          },
        });

        await writeIssueHistory(tx, issueId, actorUser.id, {
          fieldChanged: "comment",
          oldValue: null,
          newValue: "Attached fix summary from Antigravity MCP",
        });

        if (finalStatus !== issue.status) {
          await tx.issue.update({
            where: { id: issueId },
            data: { status: finalStatus },
          });

          await writeIssueHistory(tx, issueId, actorUser.id, {
            fieldChanged: "status",
            oldValue: issue.status,
            newValue: finalStatus,
          });
        }

        return commentRecord;
      });

      const warning = await attemptGitHubSync(issue.id, actorUser.id);
      return NextResponse.json({
        success: true,
        warning,
        issueId,
        commentId: comment.id,
        status: finalStatus,
      });
    }

    return NextResponse.json(
      { error: "Unknown action. Supported actions: update_status, attach_fix_summary" },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
