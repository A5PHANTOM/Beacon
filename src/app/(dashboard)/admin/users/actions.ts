"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email address is required")
    .regex(emailRegex, "Please enter a valid email address (e.g. name@company.com)"),
  password: z.string().min(4, "Password must be at least 4 characters"),
  role: z.enum(["ADMIN", "MEMBER"]),
  assignToProjectId: z.string().optional(),
  projectRole: z.enum(["DEVELOPER", "QA", "LEAD", "VIEWER"]).optional(),
});

export async function checkEmailExistsAction(email: string) {
  try {
    await requireAdmin();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return { exists: false };
    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, name: true, email: true },
    });
    return { exists: Boolean(user), user };
  } catch {
    return { exists: false };
  }
}

export async function createUserAction(formData: {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "MEMBER";
  assignToProjectId?: string;
  projectRole?: "DEVELOPER" | "QA" | "LEAD" | "VIEWER";
}) {
  try {
    await requireAdmin();

    const parsed = createUserSchema.safeParse(formData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input data",
      };
    }

    const { name, email, password, role, assignToProjectId, projectRole } = parsed.data;

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return {
        success: false,
        error: `Warning: A user with the email address "${email}" already exists. Duplicate emails cannot be used.`,
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
      },
    });

    // If an initial project and role were selected, assign the user right away
    if (assignToProjectId && projectRole) {
      await prisma.projectMember.create({
        data: {
          projectId: assignToProjectId,
          userId: newUser.id,
          roleInProject: projectRole,
        },
      });
    }

    revalidatePath("/admin/users");
    revalidatePath("/projects");

    return {
      success: true,
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create user";
    return { success: false, error: message };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    const session = await requireAdmin();

    if (session.user.id === userId) {
      return { success: false, error: "You cannot delete your own admin account." };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/admin/users");
    revalidatePath("/projects");

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete user";
    return { success: false, error: message };
  }
}
