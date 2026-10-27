"use server";

import { z } from "zod";
import { resetUserEmailSchema, userEmailSchema } from "@/lib/user-validation";
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

const updateUserDetailsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: userEmailSchema,
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function updateUserDetailsAction(data: {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
}) {
  try {
    await requireAdmin();

    const parsed = updateUserDetailsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input data",
      };
    }

    const { userId, name, email, role } = parsed.data;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // If email changed, check if already in use
    if (email !== targetUser.email.toLowerCase()) {
      const existing = await prisma.user.findUnique({
        where: { email },
      });
      if (existing && existing.id !== userId) {
        return {
          success: false,
          error: `The email "${email}" is already in use by another account.`,
        };
      }
    }

    // Prevent demoting the last admin
    if (targetUser.role === "ADMIN" && role === "MEMBER") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return {
          success: false,
          error: "Cannot change role: There must be at least one Administrator in the system.",
        };
      }
    }

    const emailChanged = email !== targetUser.email;
    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.user.updateMany({
        where: { id: userId, sessionVersion: targetUser.sessionVersion },
        data: { name, email, role,
          ...(emailChanged ? { githubId: null, githubLogin: null } : {}),
          ...(emailChanged || role !== targetUser.role ? { sessionVersion: { increment: 1 } } : {}),
        },
      });
      if (changed.count !== 1) throw new Error("Account changed while saving. Refresh and try again.");
      if (emailChanged) await tx.gitHubIssueSync.updateMany({ where: { issue: { assigneeId: userId } }, data: { assignmentSynced: false, lastError: "GitHub assignment pending: the user's email changed. They must reconnect GitHub or the issue must be reassigned." } });
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, githubLogin: true } });
    });

    revalidatePath("/admin/users");
    revalidatePath("/projects");

    return {
      success: true,
      data: updated,
    };
  } catch (err: unknown) {
    const message = err && typeof err === "object" && "code" in err && err.code === "P2002" ? "This email is already in use by another account." : "Could not update the account. Refresh and try again.";
    return { success: false, error: message };
  }
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  newPassword: z.string().min(4, "Password must be at least 4 characters"),
});

export async function resetUserPasswordAction(data: {
  userId: string;
  newPassword: string;
}) {
  try {
    await requireAdmin();

    const parsed = resetPasswordSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Password must be at least 4 characters",
      };
    }

    const { userId, newPassword } = parsed.data;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      success: true,
      message: `Password has been reset successfully for ${targetUser.name}.`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset password";
    return { success: false, error: message };
  }
}


type ResetEmailResult = { success: true; data: { id: string; name: string; email: string; githubLogin: string | null } } | { success: false; error: string };
export async function resetUserEmailAction(input: z.infer<typeof resetUserEmailSchema>): Promise<ResetEmailResult> {
  try {
    await requireAdmin();
    const parsed = resetUserEmailSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid email change." };
    const { userId, email, expectedEmail } = parsed.data;
    const data = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found.");
      if (user.email !== expectedEmail) throw new Error("This email was changed by another administrator. Refresh and try again.");
      if (user.email === email) throw new Error("Enter a different email address.");
      const duplicate = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (duplicate) throw new Error("This email is already in use by another account.");
      const changed = await tx.user.updateMany({ where: { id: userId, email: expectedEmail, sessionVersion: user.sessionVersion }, data: { email, githubId: null, githubLogin: null, sessionVersion: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("Account changed while saving. Refresh and try again.");
      await tx.gitHubIssueSync.updateMany({ where: { issue: { assigneeId: userId } }, data: { assignmentSynced: false, lastError: "GitHub assignment pending: the user's email changed. They must reconnect GitHub or the issue must be reassigned." } });
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, githubLogin: true } });
    });
    revalidatePath("/admin/users");
    revalidatePath("/projects", "layout");
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    return { success: false, error: code === "P2002" ? "This email is already in use by another account." : /^(User not found|This email|Enter a different|Account changed)/.test(message) ? message : "Could not change the email. Check your administrator permissions and retry." };
  }
}
