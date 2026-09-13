"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { writeIssueHistory } from "@/lib/history";
import { canTransition, type IssueStatus } from "@/lib/workflow";
import { revalidatePath } from "next/cache";

const createIssueSchema = z.object({
  projectId: z.string(),
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  description: z.string().trim().optional(),
  stepsToReproduce: z.string().trim().optional(),
  expected: z.string().trim().optional(),
  actual: z.string().trim().optional(),
  environment: z.string().trim().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assigneeId: z.string().min(1, "Assigning a developer is mandatory"),
});

export async function createIssueAction(data: z.infer<typeof createIssueSchema>) {
  try {
    const session = await requireAuth();
    const parsed = createIssueSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid issue data",
      };
    }

    const {
      projectId,
      title,
      description,
      stepsToReproduce,
      expected,
      actual,
      environment,
      severity,
      priority,
      assigneeId,
    } = parsed.data;

    // Verify project access
    const isAdmin = session.user.role === "ADMIN";
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!isAdmin && !membership) {
      return { success: false, error: "Access denied: You are not a member of this project" };
    }

    // Verify assigned user is a developer in this project
    const assigneeMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: assigneeId,
        },
      },
    });

    if (!assigneeMember || assigneeMember.roleInProject !== "DEVELOPER") {
      return {
        success: false,
        error: "Mandatory assignment: Please select an active developer member of this project",
      };
    }

    // Determine next issue number atomically
    const latestIssue = await prisma.issue.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (latestIssue?.number || 0) + 1;

    // Create issue and history in transaction
    const newIssue = await prisma.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          projectId,
          number: nextNumber,
          title,
          description: description || null,
          stepsToReproduce: stepsToReproduce || null,
          expected: expected || null,
          actual: actual || null,
          environment: environment || null,
          severity,
          priority,
          reporterId: session.user.id,
          assigneeId: assigneeId,
          status: "REPORTED",
        },
      });

      await writeIssueHistory(tx, issue.id, session.user.id, {
        fieldChanged: "created",
        oldValue: null,
        newValue: "Issue created",
      });

      return issue;
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: newIssue };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create issue";
    return { success: false, error: message };
  }
}

export async function updateIssueStatusAction(
  issueId: string,
  newStatus: IssueStatus,
  notes?: string
) {
  try {
    const session = await requireAuth();

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    });

    if (!issue) {
      return { success: false, error: "Issue not found" };
    }

    const isAdmin = session.user.role === "ADMIN";
    const userRoleInProject = issue.project.members[0]?.roleInProject;

    if (!isAdmin && !userRoleInProject) {
      return { success: false, error: "Access denied: Not a member of this project" };
    }

    // Role-specific workflow guards:
    // Tester (QA) can only raise issues and inspect status — CANNOT update status
    if (!isAdmin && userRoleInProject === "QA") {
      return {
        success: false,
        error: "Testers can only raise issues and check their status. Only developers can update the status.",
      };
    }

    // DEVELOPER can only transition between IN_PROGRESS, FIXED, or REJECTED
    if (!isAdmin && userRoleInProject === "DEVELOPER") {
      const allowedDevStatuses = ["IN_PROGRESS", "FIXED", "REJECTED"];
      if (!allowedDevStatuses.includes(newStatus)) {
        return {
          success: false,
          error: "Developer permission: You can only transition issues to 'In Progress', 'Fixed', or 'Rejected as problem not found'.",
        };
      }
    }

    if (!isAdmin && userRoleInProject === "VIEWER") {
      return { success: false, error: "Viewers cannot change issue status" };
    }

    // Verify transition validity in state machine
    if (!canTransition(issue.status as IssueStatus, newStatus)) {
      return {
        success: false,
        error: `Cannot transition status from ${issue.status} to ${newStatus}`,
      };
    }

    // Apply update and audit record in transaction
    await prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: { status: newStatus },
      });

      await writeIssueHistory(tx, issueId, session.user.id, {
        fieldChanged: "status",
        oldValue: issue.status,
        newValue: newStatus,
      });

      // If developer added optional resolution notes, create a comment
      if (notes && notes.trim().length > 0) {
        const statusDisplay =
          newStatus === "REJECTED"
            ? "Rejected as problem not found"
            : newStatus.replace("_", " ");
        await tx.comment.create({
          data: {
            issueId,
            userId: session.user.id,
            body: `[Status set to ${statusDisplay}]\n${notes.trim()}`,
          },
        });
      }
    });

    revalidatePath(`/projects/${issue.projectId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update status";
    return { success: false, error: message };
  }
}

export async function updateIssueDetailsAction(
  issueId: string,
  updates: {
    title?: string;
    description?: string;
    severity?: string;
    priority?: string;
    assigneeId?: string | null;
  }
) {
  try {
    const session = await requireAuth();

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    });

    if (!issue) {
      return { success: false, error: "Issue not found" };
    }

    const isAdmin = session.user.role === "ADMIN";
    const userRoleInProject = issue.project.members[0]?.roleInProject;

    if (!isAdmin && (!userRoleInProject || userRoleInProject === "VIEWER")) {
      return { success: false, error: "Permission denied" };
    }

    await prisma.$transaction(async (tx) => {
      // Track history for each changed field
      if (updates.title && updates.title !== issue.title) {
        await writeIssueHistory(tx, issueId, session.user.id, {
          fieldChanged: "title",
          oldValue: issue.title,
          newValue: updates.title,
        });
      }

      if (updates.severity && updates.severity !== issue.severity) {
        await writeIssueHistory(tx, issueId, session.user.id, {
          fieldChanged: "severity",
          oldValue: issue.severity,
          newValue: updates.severity,
        });
      }

      if (updates.priority && updates.priority !== issue.priority) {
        await writeIssueHistory(tx, issueId, session.user.id, {
          fieldChanged: "priority",
          oldValue: issue.priority,
          newValue: updates.priority,
        });
      }

      if (updates.assigneeId !== undefined && updates.assigneeId !== issue.assigneeId) {
        let assigneeName = "Unassigned";
        if (updates.assigneeId) {
          const assigneeUser = await tx.user.findUnique({
            where: { id: updates.assigneeId },
            select: { name: true },
          });
          assigneeName = assigneeUser?.name || updates.assigneeId;
        }

        await writeIssueHistory(tx, issueId, session.user.id, {
          fieldChanged: "assignee",
          oldValue: issue.assigneeId ? "Previous Assignee" : "Unassigned",
          newValue: assigneeName,
        });
      }

      await tx.issue.update({
        where: { id: issueId },
        data: {
          title: updates.title ?? undefined,
          description: updates.description ?? undefined,
          severity: updates.severity ?? undefined,
          priority: updates.priority ?? undefined,
          assigneeId: updates.assigneeId === undefined ? undefined : updates.assigneeId,
        },
      });
    });

    revalidatePath(`/projects/${issue.projectId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update issue";
    return { success: false, error: message };
  }
}

export async function addCommentAction(issueId: string, body: string) {
  try {
    const session = await requireAuth();
    if (!body || !body.trim()) {
      return { success: false, error: "Comment cannot be empty" };
    }

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    });

    if (!issue) {
      return { success: false, error: "Issue not found" };
    }

    const comment = await prisma.comment.create({
      data: {
        issueId,
        userId: session.user.id,
        body: body.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    revalidatePath(`/projects/${issue.projectId}`);
    return {
      success: true,
      data: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        user: comment.user,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add comment";
    return { success: false, error: message };
  }
}

export async function getIssueAuditHistoryAction(issueId: string) {
  try {
    await requireAuth();

    const history = await prisma.issueHistory.findMany({
      where: { issueId },
      orderBy: { changedAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const comments = await prisma.comment.findMany({
      where: { issueId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        history: history.map((h) => ({
          id: h.id,
          fieldChanged: h.fieldChanged,
          oldValue: h.oldValue,
          newValue: h.newValue,
          changedAt: h.changedAt.toISOString(),
          userName: h.user.name,
        })),
        comments: comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          user: c.user,
        })),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load history";
    return { success: false, error: message };
  }
}
