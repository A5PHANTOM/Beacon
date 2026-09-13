"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type AttachmentItem = {
  id: string;
  filename: string;
  fileUrl: string;
  size: number;
  uploadedAt: string;
  uploaderName: string;
  uploaderEmail: string;
  issueId: string;
  issueNumber: number;
  issueTitle: string;
  issueKey: string;
  projectId: string;
  projectName: string;
};

export type StorageUsageData = {
  planLimitMB: number;
  totalStorageUsedMB: number;
  storageFreeMB: number;
  percentageUsed: number;
  percentageFree: number;
  
  // Breakdown
  imageStorageBytes: number;
  imageStorageMB: number;
  imageCount: number;
  averageImageSizeKB: number;

  databaseRecordsBytes: number;
  databaseRecordsMB: number;

  counts: {
    issues: number;
    comments: number;
    history: number;
    users: number;
    projects: number;
    memberships: number;
  };

  capacityEstimates: {
    moreIssuesTextOnly: number;
    moreScreenshots: number;
  };

  attachments: AttachmentItem[];
};

export async function getStorageUsageEstimateAction(): Promise<{
  success: boolean;
  data?: StorageUsageData;
  error?: string;
}> {
  try {
    await requireAdmin();

    // 1. Fetch counts
    const [
      issueCount,
      commentCount,
      historyCount,
      userCount,
      projectCount,
      membershipCount,
      rawAttachments,
    ] = await Promise.all([
      prisma.issue.count(),
      prisma.comment.count(),
      prisma.issueHistory.count(),
      prisma.user.count(),
      prisma.project.count(),
      prisma.projectMember.count(),
      prisma.attachment.findMany({
        orderBy: { uploadedAt: "desc" },
        include: {
          user: {
            select: { name: true, email: true },
          },
          issue: {
            select: {
              id: true,
              number: true,
              title: true,
              project: {
                select: { id: true, name: true, key: true },
              },
            },
          },
        },
      }),
    ]);

    // 2. Sum image attachments exact size
    const imageStorageBytes = rawAttachments.reduce((acc, att) => acc + (att.size || 0), 0);
    const imageStorageMB = Number((imageStorageBytes / (1024 * 1024)).toFixed(3));
    const imageCount = rawAttachments.length;
    const averageImageSizeKB =
      imageCount > 0 ? Number((imageStorageBytes / imageCount / 1024).toFixed(1)) : 0;

    // 3. Estimate database text records size (Prisma / Postgres storage overhead)
    // Base catalog/indexing overhead: ~350 KB
    // Issue row (title, desc, steps, expected, actual, env): ~1.5 KB
    // Comment row: ~0.6 KB
    // IssueHistory row: ~0.4 KB
    // User row (name, email, passwordHash): ~0.8 KB
    // Project & membership rows: ~0.5 KB
    const baseOverheadBytes = 350 * 1024;
    const estimatedRowsBytes =
      issueCount * 1536 +
      commentCount * 614 +
      historyCount * 410 +
      userCount * 819 +
      (projectCount + membershipCount) * 512;

    const databaseRecordsBytes = baseOverheadBytes + estimatedRowsBytes;
    const databaseRecordsMB = Number((databaseRecordsBytes / (1024 * 1024)).toFixed(3));

    // Total used storage
    const totalStorageBytes = imageStorageBytes + databaseRecordsBytes;
    const totalStorageUsedMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));

    // Free tier quota: 512.00 MB (Prisma Postgres Free Tier)
    const planLimitMB = 512.0;
    const storageFreeMB = Number(Math.max(0, planLimitMB - totalStorageUsedMB).toFixed(2));
    const percentageUsed = Number(
      Math.min(100, Math.max(0.01, (totalStorageUsedMB / planLimitMB) * 100)).toFixed(2)
    );
    const percentageFree = Number(Math.max(0, 100 - percentageUsed).toFixed(2));

    // Estimated capacity remaining
    const remainingBytes = Math.max(0, planLimitMB * 1024 * 1024 - totalStorageBytes);
    const moreIssuesTextOnly = Math.floor(remainingBytes / 2500); // ~2.5 KB per complete issue + comments
    const avgImageOrFallback = imageStorageBytes > 0 && imageCount > 0 ? imageStorageBytes / imageCount : 180 * 1024;
    const moreScreenshots = Math.floor(remainingBytes / avgImageOrFallback);

    const attachments: AttachmentItem[] = rawAttachments.map((att) => ({
      id: att.id,
      filename: att.filename,
      fileUrl: att.fileUrl,
      size: att.size,
      uploadedAt: att.uploadedAt.toISOString(),
      uploaderName: att.user?.name || "Unknown",
      uploaderEmail: att.user?.email || "Unknown",
      issueId: att.issue.id,
      issueNumber: att.issue.number,
      issueTitle: att.issue.title,
      issueKey: `${att.issue.project.key}-${att.issue.number}`,
      projectId: att.issue.project.id,
      projectName: att.issue.project.name,
    }));

    return {
      success: true,
      data: {
        planLimitMB,
        totalStorageUsedMB,
        storageFreeMB,
        percentageUsed,
        percentageFree,
        imageStorageBytes,
        imageStorageMB,
        imageCount,
        averageImageSizeKB,
        databaseRecordsBytes,
        databaseRecordsMB,
        counts: {
          issues: issueCount,
          comments: commentCount,
          history: historyCount,
          users: userCount,
          projects: projectCount,
          memberships: membershipCount,
        },
        capacityEstimates: {
          moreIssuesTextOnly,
          moreScreenshots,
        },
        attachments,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to calculate storage usage";
    return { success: false, error: message };
  }
}

export async function deleteIssueAttachmentAction(attachmentId: string): Promise<{
  success: boolean;
  freedBytes?: number;
  filename?: string;
  error?: string;
}> {
  try {
    const adminUser = await requireAdmin();

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        issue: {
          select: {
            id: true,
            number: true,
            projectId: true,
            project: { select: { key: true } },
          },
        },
      },
    });

    if (!attachment) {
      return { success: false, error: "Attachment not found" };
    }

    // Delete ONLY the attachment record
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Record audit history on the issue noting the attachment was pruned by admin
    const freedKB = (attachment.size / 1024).toFixed(1);
    await prisma.issueHistory.create({
      data: {
        issueId: attachment.issue.id,
        userId: adminUser.user.id,
        fieldChanged: "attachment",
        oldValue: attachment.filename,
        newValue: `Screenshot pruned by Admin (${freedKB} KB freed)`,
      },
    });

    revalidatePath("/admin/usage");
    revalidatePath(`/projects/${attachment.issue.projectId}`);

    return {
      success: true,
      freedBytes: attachment.size,
      filename: attachment.filename,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete attachment";
    return { success: false, error: message };
  }
}

export async function bulkDeleteIssueAttachmentsAction(attachmentIds: string[]): Promise<{
  success: boolean;
  deletedCount: number;
  freedBytes: number;
  error?: string;
}> {
  try {
    const adminUser = await requireAdmin();

    if (!attachmentIds || attachmentIds.length === 0) {
      return { success: true, deletedCount: 0, freedBytes: 0 };
    }

    const attachments = await prisma.attachment.findMany({
      where: { id: { in: attachmentIds } },
      include: { issue: { select: { id: true, projectId: true } } },
    });

    let totalFreed = 0;
    const projectIds = new Set<string>();

    for (const att of attachments) {
      totalFreed += att.size || 0;
      projectIds.add(att.issue.projectId);

      await prisma.issueHistory.create({
        data: {
          issueId: att.issue.id,
          userId: adminUser.user.id,
          fieldChanged: "attachment",
          oldValue: att.filename,
          newValue: `Screenshot pruned in bulk by Admin (${(att.size / 1024).toFixed(1)} KB freed)`,
        },
      });
    }

    await prisma.attachment.deleteMany({
      where: { id: { in: attachmentIds } },
    });

    revalidatePath("/admin/usage");
    projectIds.forEach((pid) => revalidatePath(`/projects/${pid}`));

    return {
      success: true,
      deletedCount: attachments.length,
      freedBytes: totalFreed,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete attachments";
    return { success: false, deletedCount: 0, freedBytes: 0, error: message };
  }
}
