"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters"),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Project key must be 2-10 characters")
    .max(10, "Project key must be 2-10 characters")
    .regex(/^[A-Z0-9]+$/, "Project key must contain only uppercase letters and numbers"),
  description: z.string().trim().optional(),
});

export async function createProjectAction(formData: {
  name: string;
  key: string;
  description?: string;
}) {
  try {
    const session = await requireAuth();

    if (session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "Permission denied: Only administrators have the privilege of creating projects.",
      };
    }

    const parsed = createProjectSchema.safeParse(formData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input data",
      };
    }

    const { name, key, description } = parsed.data;

    // Check if key is already taken
    const existing = await prisma.project.findUnique({
      where: { key },
    });

    if (existing) {
      return { success: false, error: `Project key "${key}" is already in use.` };
    }

    // Create project and assign creator as LEAD
    const project = await prisma.project.create({
      data: {
        name,
        key,
        description: description || null,
        createdById: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            roleInProject: "LEAD",
          },
        },
      },
    });

    revalidatePath("/projects");
    return { success: true, data: project };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create project";
    return { success: false, error: message };
  }
}

const assignMemberSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  roleInProject: z.enum(["LEAD", "DEVELOPER", "QA", "VIEWER"]),
});

export async function assignProjectMemberAction(data: {
  projectId: string;
  userId: string;
  roleInProject: "LEAD" | "DEVELOPER" | "QA" | "VIEWER";
}) {
  try {
    const session = await requireAuth();
    const parsed = assignMemberSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid member assignment data" };
    }

    const { projectId, userId, roleInProject } = parsed.data;

    // Strictly restrict assigning members to global ADMIN
    if (session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "Permission denied: Only administrators have the privilege of assigning project members.",
      };
    }

    // Upsert project member
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      update: {
        roleInProject,
      },
      create: {
        projectId,
        userId,
        roleInProject,
      },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to assign member";
    return { success: false, error: message };
  }
}

export async function removeProjectMemberAction(projectId: string, userId: string) {
  try {
    const session = await requireAuth();

    // Strictly restrict revoking members to global ADMIN
    if (session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "Permission denied: Only administrators have the privilege of revoking project members.",
      };
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove member";
    return { success: false, error: message };
  }
}

const deleteProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export async function deleteProjectAction(data: { projectId: string }) {
  try {
    const session = await requireAuth();
    const parsed = deleteProjectSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid project ID" };
    }

    const { projectId } = parsed.data;

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Check permissions: Admin, Project Creator, or Project Lead
    const isAdmin = session.user.role === "ADMIN";
    const isCreator = project.createdById === session.user.id;
    const userMembership = project.members.find((m) => m.userId === session.user.id);
    const isLead = userMembership?.roleInProject === "LEAD";

    if (!isAdmin && !isCreator && !isLead) {
      return {
        success: false,
        error: "Permission denied: Only Administrators or Project Leads can delete this project.",
      };
    }

    // Delete project (cascade deletes dependent records)
    await prisma.project.delete({
      where: { id: projectId },
    });

    revalidatePath("/projects");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete project";
    return { success: false, error: message };
  }
}

