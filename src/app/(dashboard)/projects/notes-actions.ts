"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ProjectContactItem = {
  id: string;
  name: string;
  email: string;
  role?: string;
  notes?: string;
};

export type ProjectCredentialItem = {
  id: string;
  title: string;
  url?: string;
  username?: string;
  password?: string;
  category?: string;
  notes?: string;
  updatedAt?: string;
};

export type ProjectNotesData = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  notes: string;
  contacts: ProjectContactItem[];
  credentials: ProjectCredentialItem[];
  members: {
    userId: string;
    name: string;
    email: string;
    roleInProject: string;
  }[];
};

const getNotesSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

const saveNotesSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  notes: z.string().default(""),
  contacts: z.string().default("[]"), // serialized JSON string of ProjectContactItem[]
  credentials: z.string().default("[]"), // serialized JSON string of ProjectCredentialItem[]
});

export async function getProjectNotesAction(projectId: string): Promise<{
  success: boolean;
  data?: ProjectNotesData;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const parsed = getNotesSchema.safeParse({ projectId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid project ID" };
    }

    const isAdmin = session.user.role === "ADMIN";

    // Check project membership or admin access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    const isMember = project.members.some((m) => m.userId === session.user.id);
    if (!isAdmin && !isMember) {
      return { success: false, error: "Access denied: you are not a member of this project" };
    }

    let parsedContacts: ProjectContactItem[] = [];
    if (project.contacts) {
      try {
        const parsedJson = JSON.parse(project.contacts);
        if (Array.isArray(parsedJson)) {
          parsedContacts = parsedJson;
        }
      } catch {
        parsedContacts = [];
      }
    }

    let parsedCredentials: ProjectCredentialItem[] = [];
    if (project.credentials) {
      try {
        const parsedJson = JSON.parse(project.credentials);
        if (Array.isArray(parsedJson)) {
          parsedCredentials = parsedJson;
        }
      } catch {
        parsedCredentials = [];
      }
    }

    const formattedMembers = project.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      roleInProject: m.roleInProject,
    }));

    return {
      success: true,
      data: {
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        notes: project.notes || "",
        contacts: parsedContacts,
        credentials: parsedCredentials,
        members: formattedMembers,
      },
    };
  } catch (err: any) {
    console.error("Error fetching project notes & credentials:", err);
    return {
      success: false,
      error: err?.message || "Failed to load project notes and credentials",
    };
  }
}

export async function saveProjectNotesAction(input: {
  projectId: string;
  notes: string;
  contacts: string;
  credentials?: string;
}): Promise<{
  success: boolean;
  data?: {
    id: string;
    notes: string;
    contacts: ProjectContactItem[];
    credentials: ProjectCredentialItem[];
  };
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const parsed = saveNotesSchema.safeParse({
      projectId: input.projectId,
      notes: input.notes,
      contacts: input.contacts,
      credentials: input.credentials || "[]",
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid inputs" };
    }

    const { projectId, notes, contacts, credentials } = parsed.data;

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
      return { success: false, error: "Access denied: you cannot edit credentials for this project" };
    }

    // Validate contacts JSON
    let validatedContacts: ProjectContactItem[] = [];
    try {
      const parsedContacts = JSON.parse(contacts);
      if (Array.isArray(parsedContacts)) {
        validatedContacts = parsedContacts.map((c, idx) => ({
          id: String(c.id || `contact-${Date.now()}-${idx}`),
          name: String(c.name || "").trim(),
          email: String(c.email || "").trim(),
          role: c.role ? String(c.role).trim() : undefined,
          notes: c.notes ? String(c.notes).trim() : undefined,
        }));
      }
    } catch {
      return { success: false, error: "Contacts must be formatted as valid JSON array" };
    }

    // Validate credentials JSON
    let validatedCredentials: ProjectCredentialItem[] = [];
    try {
      const parsedCreds = JSON.parse(credentials);
      if (Array.isArray(parsedCreds)) {
        validatedCredentials = parsedCreds.map((c, idx) => ({
          id: String(c.id || `cred-${Date.now()}-${idx}`),
          title: String(c.title || "Untitled Credential").trim(),
          url: c.url ? String(c.url).trim() : undefined,
          username: c.username ? String(c.username).trim() : undefined,
          password: c.password ? String(c.password) : undefined,
          category: c.category ? String(c.category).trim() : "General",
          notes: c.notes ? String(c.notes).trim() : undefined,
          updatedAt: c.updatedAt || new Date().toISOString(),
        }));
      }
    } catch {
      return { success: false, error: "Credentials must be formatted as valid JSON array" };
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        notes,
        contacts: JSON.stringify(validatedContacts),
        credentials: JSON.stringify(validatedCredentials),
      },
      select: {
        id: true,
        notes: true,
        contacts: true,
        credentials: true,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return {
      success: true,
      data: {
        id: updated.id,
        notes: updated.notes || "",
        contacts: validatedContacts,
        credentials: validatedCredentials,
      },
    };
  } catch (err: any) {
    console.error("Error saving project notes & credentials:", err);
    return {
      success: false,
      error: err?.message || "Failed to save project notes and credentials",
    };
  }
}
