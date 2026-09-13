import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "ADMIN";

  // Fetch projects
  const rawProjects = await prisma.project.findMany({
    where: isAdmin
      ? undefined
      : {
          members: {
            some: { userId: session.user.id },
          },
        },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          issues: true,
          members: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
      issues: {
        where: {
          status: {
            notIn: ["FIXED", "VERIFIED", "CLOSED"],
          },
        },
        select: {
          id: true,
        },
      },
    },
  });

  // Fetch all users so Admins or Leads can assign developers/testers
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  const projects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
    description: p.description,
    createdById: p.createdById,
    createdAt: p.createdAt.toISOString(),
    _count: {
      issues: p._count.issues,
      members: p._count.members,
    },
    openIssuesCount: p.issues.length,
    members: p.members.map((m) => ({
      userId: m.userId,
      userName: m.user.name,
      userEmail: m.user.email,
      userRole: m.user.role,
      roleInProject: m.roleInProject,
    })),
  }));

  return (
    <ProjectsClient
      initialProjects={projects}
      allUsers={allUsers}
      currentUserId={session.user.id}
      isAdmin={isAdmin}
    />
  );
}
