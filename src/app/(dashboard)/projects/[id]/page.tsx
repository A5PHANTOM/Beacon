import { notFound, redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { IssueWorkspace, type WorkspaceIssue, type ProjectMemberItem } from "@/components/issues/workspace";
import type { IssueStatus } from "@/lib/workflow";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectIssuesPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  // Find project by ID or key (e.g. BCN or beacon)
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { id: id },
        { key: id.toUpperCase() },
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const isAdmin = session.user.role === "ADMIN";
  const userMembership = project.members.find((m) => m.userId === session.user.id);

  if (!isAdmin && !userMembership) {
    redirect("/projects");
  }

  // Fetch project issues
  const rawIssues = await prisma.issue.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: {
        select: { name: true },
      },
      assignee: {
        select: { name: true },
      },
      _count: {
        select: { comments: true, attachments: true },
      },
    },
  });

  const issues: WorkspaceIssue[] = rawIssues.map((i) => ({
    id: i.id,
    projectId: i.projectId,
    number: i.number,
    key: `${project.key}-${i.number}`,
    title: i.title,
    description: i.description,
    stepsToReproduce: i.stepsToReproduce,
    expected: i.expected,
    actual: i.actual,
    environment: i.environment,
    status: i.status as IssueStatus,
    severity: i.severity as WorkspaceIssue["severity"],
    priority: i.priority as WorkspaceIssue["priority"],
    assigneeId: i.assigneeId,
    assigneeName: i.assignee?.name || "Unassigned",
    reporterName: i.reporter.name,
    updatedAt: i.updatedAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
    commentsCount: i._count.comments,
    attachmentsCount: i._count.attachments,
  }));

  const members: ProjectMemberItem[] = project.members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    roleInProject: m.roleInProject,
  }));

  return (
    <IssueWorkspace
      project={{
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
      }}
      initialIssues={issues}
      members={members}
      currentUser={{
        id: session.user.id,
        name: session.user.name || "User",
        email: session.user.email || "",
        role: session.user.role,
        roleInProject: userMembership?.roleInProject || (isAdmin ? "LEAD" : "VIEWER"),
      }}
    />
  );
}
