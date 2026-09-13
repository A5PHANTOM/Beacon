import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/projects");
  }

  const [rawUsers, rawProjects] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          include: {
            project: {
              select: {
                name: true,
                key: true,
              },
            },
          },
        },
        _count: {
          select: {
            reported: true,
            assigned: true,
          },
        },
      },
    }),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        key: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const users = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    memberships: u.memberships.map((m) => ({
      projectId: m.projectId,
      projectName: m.project.name,
      projectKey: m.project.key,
      roleInProject: m.roleInProject,
    })),
    _count: u._count,
  }));

  return (
    <UsersClient
      initialUsers={users}
      projects={rawProjects}
      currentUserId={session.user.id}
    />
  );
}
