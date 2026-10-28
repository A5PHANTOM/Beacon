"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { writeIssueHistory } from "@/lib/history";
import { canTransition, issueStatuses, type IssueStatus } from "@/lib/workflow";
import { revalidatePath } from "next/cache";
import { analyzeIssueWithAI, type AIProviderConfig } from "@/lib/ai";

import { validateProjectAssignee } from "@/lib/project-assignees";
import { attemptGitHubSync } from "@/lib/github";
import { can } from "@/lib/permissions";
import type { GlobalRole, ProjectRole } from "@/lib/types";

function issueMutationError(error: unknown, fallback: string) {
  if (error instanceof Error && /^(Issue changed while saving|Could not reserve an issue number)/.test(error.message)) return error.message;
  if (error instanceof Error && error.message === "UNAUTHORIZED") return "Please sign in again.";
  return fallback;
}

const imageItemSchema = z.object({
  filename: z.string(),
  fileUrl: z.string(),
  size: z.number().default(0),
});

const createIssueSchema = z.object({
  projectId: z.string(),
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  description: z.string().trim().optional(),
  stepsToReproduce: z.string().trim().optional(),
  expected: z.string().trim().optional(),
  actual: z.string().trim().optional(),
  environment: z.string().trim().optional(),
  severity: z.enum(["UI", "BACKEND", "AI", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("UI"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assigneeId: z.string().min(1, "Assigning a developer is mandatory"),
  image: imageItemSchema.optional(),
  images: z.array(imageItemSchema).optional(),
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
      image,
      images,
    } = parsed.data;

    // Consolidate images (support both single image and multiple images array)
    const allImages: Array<{ filename: string; fileUrl: string; size: number }> = [];
    if (images && images.length > 0) {
      allImages.push(...images);
    }
    if (image && image.fileUrl && !allImages.some((i) => i.fileUrl === image.fileUrl)) {
      allImages.push(image);
    }

    // Verify project access
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!can((membership?.roleInProject ?? "VIEWER") as ProjectRole, "issue:create", session.user.role as GlobalRole)) {
      return { success: false, error: "Access denied: You are not a member of this project" };
    }

    try { await validateProjectAssignee(projectId, assigneeId); }
    catch { return { success: false, error: "Selected developer is not assignable. Refresh the developer list and check their Beacon membership and GitHub repository access." }; }

    // Retry issue-number collisions from concurrent creates. Each attempt is atomic.
    const newIssue = await (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
    const latestIssue = await prisma.issue.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (latestIssue?.number || 0) + 1;

    // Create issue, attachments (if provided), and history in transaction
    try { return await prisma.$transaction(async (tx) => {
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

      if (allImages.length > 0) {
        for (const img of allImages) {
          if (img.fileUrl) {
            await tx.attachment.create({
              data: {
                issueId: issue.id,
                uploadedBy: session.user.id,
                filename: img.filename,
                fileUrl: img.fileUrl,
                size: img.size,
              },
            });
          }
        }
      }

      const historySummary =
        allImages.length === 1
          ? `Issue created with attachment (${allImages[0].filename})`
          : allImages.length > 1
          ? `Issue created with ${allImages.length} attachments (${allImages.map((i) => i.filename).join(", ")})`
          : "Issue created";

      await writeIssueHistory(tx, issue.id, session.user.id, {
        fieldChanged: "created",
        oldValue: null,
        newValue: historySummary,
      });

      return issue;
    });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (attempt < 2 && (code === "P2002" || code === "P2028")) continue;
      throw error;
    }
      }
      throw new Error("Could not reserve an issue number. Please retry.");
    })();

    const warning = await attemptGitHubSync(newIssue.id, session.user.id);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: newIssue, warning };
  } catch (err: unknown) {
    const message = issueMutationError(err, "Failed to create issue. Please refresh and try again.");
    return { success: false, error: message };
  }
}

const addIssueAttachmentsSchema = z.object({
  issueId: z.string(),
  projectId: z.string(),
  images: z.array(imageItemSchema).min(1, "At least one image is required"),
});

export async function addIssueAttachmentsAction(data: z.infer<typeof addIssueAttachmentsSchema>) {
  try {
    const session = await requireAuth();
    const parsed = addIssueAttachmentsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid attachments data",
      };
    }

    const { issueId, projectId, images } = parsed.data;

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

    // Verify issue belongs to this project
    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        projectId,
      },
      select: { id: true, number: true },
    });

    if (!issue) {
      return { success: false, error: "Issue not found in this project" };
    }

    // Create attachments and log history in transaction
    const createdAttachments = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const img of images) {
        if (img.fileUrl) {
          const rec = await tx.attachment.create({
            data: {
              issueId,
              uploadedBy: session.user.id,
              filename: img.filename,
              fileUrl: img.fileUrl,
              size: img.size,
            },
          });
          records.push(rec);
        }
      }

      const filenames = images.map((i) => i.filename).join(", ");
      await writeIssueHistory(tx, issueId, session.user.id, {
        fieldChanged: "attachment",
        oldValue: null,
        newValue: `Added ${images.length} attachment(s): ${filenames}`,
      });

      return records;
    });

    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      data: {
        attachments: createdAttachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          fileUrl: a.fileUrl,
          size: a.size,
          uploadedAt: a.uploadedAt.toISOString(),
        })),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to upload attachments";
    return { success: false, error: message };
  }
}

export async function deleteIssueAttachmentFromProjectAction(
  attachmentId: string,
  projectId: string
) {
  try {
    const session = await requireAuth();
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
      return { success: false, error: "Access denied" };
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        issue: {
          select: { id: true, projectId: true },
        },
      },
    });

    if (!attachment || attachment.issue.projectId !== projectId) {
      return { success: false, error: "Attachment not found" };
    }

    // Only allow uploader, project lead, or admin to delete
    const isUploader = attachment.uploadedBy === session.user.id;
    const isLead = membership?.roleInProject === "LEAD";
    if (!isAdmin && !isUploader && !isLead) {
      return { success: false, error: "You do not have permission to delete this attachment" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.attachment.delete({
        where: { id: attachmentId },
      });

      await writeIssueHistory(tx, attachment.issue.id, session.user.id, {
        fieldChanged: "attachment",
        oldValue: attachment.filename,
        newValue: `Deleted attachment (${attachment.filename})`,
      });
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete attachment";
    return { success: false, error: message };
  }
}

export async function updateIssueStatusAction(
  issueId: string,
  newStatus: IssueStatus | string,
  notes?: string
) {
  try {
    const session = await requireAuth();
    const parsed = z.object({ issueId: z.string().min(1), newStatus: z.string().min(1).max(100), notes: z.string().trim().max(10000).optional() }).safeParse({ issueId, newStatus, notes });
    if (!parsed.success) return { success: false, error: "Invalid status update" };
    ({ issueId, newStatus, notes } = parsed.data);

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

    if (!issueStatuses.includes(newStatus as IssueStatus)) {
      const custom = await prisma.customStatus.findFirst({ where: { key: newStatus, OR: [{ projectId: null }, { projectId: issue.projectId }] } });
      if (!custom) return { success: false, error: "Unknown status for this project" };
    }

    // Role-specific workflow guards:
    // DEVELOPER and QA (Tester) can transition between pipeline statuses or custom statuses
    if (!isAdmin && (userRoleInProject === "DEVELOPER" || userRoleInProject === "QA")) {
      const allowedPipelineStatuses: string[] = [
        "OPEN",
        "READY_FOR_DEV",
        "DEV_IN_PROGRESS",
        "DEV_REVIEW",
        "DEV_COMPLETED",
        "DEV_DEPLOYED",
        "QA_IN_PROGRESS",
        "QA_DEPLOYED",
        "READY_FOR_RELEASE",
        "PROD_DEPLOYED",
        "CLOSED",
        "INVALID",
        "IN_PROGRESS",
        "FIXED",
        "REJECTED",
      ];
      const isCustom = await prisma.customStatus.findFirst({
        where: { key: newStatus, OR: [{ projectId: null }, { projectId: issue.projectId }] },
      });
      if (!allowedPipelineStatuses.includes(newStatus) && !isCustom) {
        return {
          success: false,
          error: "Permission denied: Invalid status transition target.",
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
      const changed = await tx.issue.updateMany({
        where: { id: issueId, updatedAt: issue.updatedAt },
        data: { status: newStatus },
      });
      if (changed.count !== 1) throw new Error("Issue changed while saving. Refresh and try again.");

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

    const warning = await attemptGitHubSync(issue.id, session.user.id);
    revalidatePath(`/projects/${issue.projectId}`);
    return { success: true, warning };
  } catch (err: unknown) {
    const message = issueMutationError(err, "Failed to update status. Please refresh and try again.");
    return { success: false, error: message };
  }
}

export async function updateIssueDetailsAction(
  issueId: string,
  updates: {
    title?: string;
    description?: string;
    stepsToReproduce?: string;
    expected?: string | null;
    actual?: string | null;
    environment?: string | null;
    severity?: string;
    priority?: string;
    assigneeId?: string | null;
  }
) {
  try {
    const session = await requireAuth();
    const parsed = z.object({
      issueId: z.string().min(1),
      updates: z.object({
        title: z.string().trim().min(3).max(500).optional(), description: z.string().max(50000).optional(),
        stepsToReproduce: z.string().max(50000).optional(), expected: z.string().max(50000).nullable().optional(),
        actual: z.string().max(50000).nullable().optional(), environment: z.string().max(1000).nullable().optional(),
        severity: z.enum(["UI", "BACKEND", "AI", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(), assigneeId: z.string().min(1).nullable().optional(),
      }).strict(),
    }).safeParse({ issueId, updates });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    ({ issueId, updates } = parsed.data);

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

    const userRoleInProject = issue.project.members[0]?.roleInProject;

    if (!can((userRoleInProject ?? "VIEWER") as ProjectRole, "issue:update", session.user.role as GlobalRole)) {
      return { success: false, error: "Permission denied" };
    }

    if (updates.assigneeId) {
      try { await validateProjectAssignee(issue.projectId, updates.assigneeId); }
      catch { return { success: false, error: "Selected developer is not assignable. Refresh the list and check their Beacon membership and GitHub repository access." }; }
    }
    await prisma.$transaction(async (tx) => {
      for (const field of ["description", "stepsToReproduce", "environment"] as const) {
        if (updates[field] !== undefined && updates[field] !== issue[field]) {
          await writeIssueHistory(tx, issueId, session.user.id, { fieldChanged: field, oldValue: issue[field], newValue: updates[field] });
        }
      }
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

      if (updates.expected !== undefined && updates.expected !== issue.expected) {
        await writeIssueHistory(tx, issueId, session.user.id, {
          fieldChanged: "expected",
          oldValue: issue.expected,
          newValue: updates.expected,
        });
      }

      if (updates.actual !== undefined && updates.actual !== issue.actual) {
        await writeIssueHistory(tx, issueId, session.user.id, {
          fieldChanged: "actual",
          oldValue: issue.actual,
          newValue: updates.actual,
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
          oldValue: issue.assigneeId ? (await tx.user.findUnique({ where: { id: issue.assigneeId }, select: { name: true } }))?.name ?? "Previous developer" : "Unassigned",
          newValue: assigneeName,
        });
      }

      const changed = await tx.issue.updateMany({
        where: { id: issueId, updatedAt: issue.updatedAt },
        data: {
          title: updates.title ?? undefined,
          description: updates.description ?? undefined,
          stepsToReproduce: updates.stepsToReproduce ?? undefined,
          expected: updates.expected === undefined ? undefined : updates.expected,
          actual: updates.actual === undefined ? undefined : updates.actual,
          environment: updates.environment === undefined ? undefined : updates.environment,
          severity: updates.severity ?? undefined,
          priority: updates.priority ?? undefined,
          assigneeId: updates.assigneeId === undefined ? undefined : updates.assigneeId,
        },
      });
      if (changed.count !== 1) throw new Error("Issue changed while saving. Refresh and try again.");
    });

    const warning = await attemptGitHubSync(issue.id, session.user.id);
    revalidatePath(`/projects/${issue.projectId}`);
    return { success: true, warning };
  } catch (err: unknown) {
    const message = issueMutationError(err, "Failed to update issue. Please refresh and try again.");
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

    const attachments = await prisma.attachment.findMany({
      where: { issueId },
      orderBy: { uploadedAt: "desc" },
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
        attachments: attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          fileUrl: a.fileUrl,
          size: a.size,
          uploadedAt: a.uploadedAt.toISOString(),
        })),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load history";
    return { success: false, error: message };
  }
}

const analyzeIssueSchema = z.object({
  projectId: z.string(),
  description: z.string().trim().default(""),
  images: z.array(imageItemSchema).max(10, "Maximum 10 screenshots allowed").default([]),
  apiKeyOverride: z.string().trim().optional(),
  providerOverride: z.enum(["gemini", "openai", "anthropic", "groq", "openrouter", "custom"]).optional(),
  modelOverride: z.string().trim().optional(),
});

export async function analyzeIssueWithAIAction(data: z.infer<typeof analyzeIssueSchema>) {
  try {
    const session = await requireAuth();
    const parsed = analyzeIssueSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid analysis request",
      };
    }

    const { projectId, description, images, apiKeyOverride, providerOverride, modelOverride } = parsed.data;

    if (!description && images.length === 0) {
      return {
        success: false,
        error: "Please provide either a bug description or upload at least one screenshot.",
      };
    }

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

    // Fetch project details for context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, key: true },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Fetch user record for stored Gemini API key, model, and usage limits
    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { geminiApiKey: true, geminiModel: true, aiUsageCount: true, aiUsageLimit: true },
    });

    const userKey = apiKeyOverride || userRecord?.geminiApiKey;

    // Check usage limit if user has a limit configured
    if (userRecord && userRecord.aiUsageLimit > 0 && userRecord.aiUsageCount >= userRecord.aiUsageLimit) {
      return {
        success: false,
        error: `AI usage limit reached (${userRecord.aiUsageCount}/${userRecord.aiUsageLimit} calls). You can update your limit or reset usage from AI Settings on the sidebar.`,
      };
    }

    let customConfig: AIProviderConfig | null = null;
    if (userKey) {
      customConfig = {
        provider: providerOverride || "gemini",
        apiKey: userKey,
        model: modelOverride || userRecord?.geminiModel || process.env.GEMINI_MODEL || "gemini-2.5-flash",
      };
    }

    const analysis = await analyzeIssueWithAI({
      description,
      images,
      projectContext: { name: project.name, key: project.key },
      config: customConfig,
    });

    // Increment user's AI usage count upon successful analysis
    if (userRecord) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { aiUsageCount: { increment: 1 } },
      });
    }

    return {
      success: true,
      data: analysis,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to analyze issue with AI";
    return { success: false, error: message };
  }
}
