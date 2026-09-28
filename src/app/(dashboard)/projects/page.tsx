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
        select: {
          id: true,
          status: true,
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

  const projects = rawProjects.map((p) => {
    const devCompletedCount = p.issues.filter(
      (i) => i.status === "DEV_COMPLETED" || i.status === "FIXED"
    ).length;

    const devDeployedCount = p.issues.filter(
      (i) =>
        i.status === "DEV_DEPLOYED" ||
        i.status === "QA_DEPLOYED" ||
        i.status === "READY_FOR_RELEASE" ||
        i.status === "PROD_DEPLOYED" ||
        i.status === "VERIFIED" ||
        i.status === "CLOSED"
    ).length;

    const rejectedCount = p.issues.filter(
      (i) => i.status === "REJECTED" || i.status === "INVALID"
    ).length;

    const openIssuesCount = Math.max(
      0,
      p._count.issues - (devCompletedCount + devDeployedCount + rejectedCount)
    );

    return {
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
      openIssuesCount,
      devCompletedCount,
      devDeployedCount,
      rejectedCount,
      members: p.members.map((m) => ({
        userId: m.userId,
        userName: m.user.name,
        userEmail: m.user.email,
        userRole: m.user.role,
        roleInProject: m.roleInProject,
      })),
    };
  });

  return (
    <ProjectsClient
      initialProjects={projects}
      allUsers={allUsers}
      currentUserId={session.user.id}
      isAdmin={isAdmin}
    />
  );
}
