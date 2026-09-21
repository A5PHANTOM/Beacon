"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, getServerAuthSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const createCustomStatusSchema = z.object({
  label: z.string().trim().min(2, "Status label must be at least 2 characters").max(40, "Label cannot exceed 40 characters"),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Status key must be at least 2 characters")
    .max(30, "Key cannot exceed 30 characters")
    .regex(/^[A-Z0-9_]+$/, "Key can only contain uppercase letters, numbers, and underscores"),
  color: z
    .string()
    .trim()
    .regex(hexColorRegex, "Color must be a valid hex color code (e.g. #3B82F6)"),
  category: z.enum(["TODO", "IN_PROGRESS", "DONE", "INVALID"]),
  description: z.string().trim().max(200, "Description cannot exceed 200 characters").optional(),
  projectId: z.string().optional(),
});

export type CustomStatusItem = {
  id: string;
  key: string;
  label: string;
  color: string;
  category: "TODO" | "IN_PROGRESS" | "DONE" | "INVALID";
  description: string | null;
  projectId: string | null;
  order: number;
  createdAt: string;
  issuesCount?: number;
};

export async function getCustomStatusesAction(projectId?: string): Promise<{
  success: boolean;
  data?: CustomStatusItem[];
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return { success: false, error: "Authentication required" };
    }

    const whereClause: {
      OR?: Array<{ projectId: string | null }>;
      projectId?: string | null;
    } = projectId
      ? {
          OR: [{ projectId: null }, { projectId }],
        }
      : {};

    const customStatuses = await prisma.customStatus.findMany({
      where: whereClause,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    // Count issues per status
    const counts = await prisma.issue.groupBy({
      by: ["status"],
      _count: { status: true },
    });
    const countMap = new Map<string, number>();
    counts.forEach((c) => {
      countMap.set(c.status, c._count.status);
    });

    return {
      success: true,
      data: customStatuses.map((s) => ({
        id: s.id,
        key: s.key,
        label: s.label,
        color: s.color,
        category: s.category as CustomStatusItem["category"],
        description: s.description,
        projectId: s.projectId,
        order: s.order,
        createdAt: s.createdAt.toISOString(),
        issuesCount: countMap.get(s.key) || 0,
      })),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load custom statuses";
    return { success: false, error: message };
  }
}

export async function createCustomStatusAction(formData: {
  label: string;
  key?: string;
  color: string;
  category: "TODO" | "IN_PROGRESS" | "DONE" | "INVALID";
  description?: string;
  projectId?: string;
}) {
  try {
    await requireAdmin();

    // Auto-generate key from label if not provided or empty
    const generatedKey = formData.key && formData.key.trim()
      ? formData.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")
      : formData.label.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");

    const parsed = createCustomStatusSchema.safeParse({
      ...formData,
      key: generatedKey,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid status data",
      };
    }

    const { key, label, color, category, description, projectId } = parsed.data;

    // Check if key already exists in CustomStatus
    const existing = await prisma.customStatus.findUnique({
      where: { key },
    });

    if (existing) {
      return {
        success: false,
        error: `A status with key '${key}' already exists. Please choose a different key.`,
      };
    }

    const created = await prisma.customStatus.create({
      data: {
        key,
        label,
        color,
        category,
        description: description || null,
        projectId: projectId || null,
      },
    });

    revalidatePath("/admin/statuses");
    revalidatePath("/projects");

    return {
      success: true,
      data: {
        id: created.id,
        key: created.key,
        label: created.label,
        color: created.color,
        category: created.category as CustomStatusItem["category"],
        description: created.description,
        projectId: created.projectId,
        order: created.order,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create custom status";
    return { success: false, error: message };
  }
}

export async function deleteCustomStatusAction(statusId: string) {
  try {
    await requireAdmin();

    const status = await prisma.customStatus.findUnique({
      where: { id: statusId },
    });

    if (!status) {
      return { success: false, error: "Status not found" };
    }

    // Check if any issues use this status
    const issueCount = await prisma.issue.count({
      where: { status: status.key },
    });

    if (issueCount > 0) {
      return {
        success: false,
        error: `Cannot delete status '${status.label}' because it is assigned to ${issueCount} issue(s). Reassign those issues before deleting.`,
      };
    }

    await prisma.customStatus.delete({
      where: { id: statusId },
    });

    revalidatePath("/admin/statuses");
    revalidatePath("/projects");

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete custom status";
    return { success: false, error: message };
  }
}
