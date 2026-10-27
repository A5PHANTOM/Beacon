import { notFound, redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { IssueWorkspace, type WorkspaceIssue, type ProjectMemberItem } from "@/components/issues/workspace";
import type { IssueStatus } from "@/lib/workflow";

import { GitHubConnectionPanel } from "@/components/projects/github-connection";
import { can } from "@/lib/permissions";
import type { GlobalRole, ProjectRole } from "@/lib/types";

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
      github: { select: { owner: true, repo: true, enabled: true, inboundEnabled: true, lastWebhookError: true } },
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
    orderBy: { number: "desc" },
    include: {
      githubSync: true,
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
    githubIssueUrl: i.githubSync?.number && project.github ? `https://github.com/${encodeURIComponent(project.github.owner)}/${encodeURIComponent(project.github.repo)}/issues/${i.githubSync.number}` : null,
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
    reporterId: i.reporterId,
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

  // Fetch custom statuses applicable to this project
  const rawCustomStatuses = await prisma.customStatus.findMany({
    where: {
      OR: [{ projectId: null }, { projectId: project.id }],
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const customStatuses = rawCustomStatuses.map((s) => ({
    id: s.id,
    key: s.key,
    label: s.label,
    color: s.color,
    category: s.category,
    description: s.description,
  }));

  const incomingPending = await prisma.gitHubWebhookDelivery.count({ where: { projectId: project.id, processedAt: null } });
  const pending = rawIssues.filter(i => !i.githubSync?.assignmentSynced || !i.githubSync.syncedAt || i.githubSync.lastError || i.githubSync.syncedAt < i.updatedAt);

  return (
    <IssueWorkspace
      githubInboundEnabled={!!project.github?.enabled && !!project.github?.inboundEnabled}
      assignmentConnectionKey={project.github ? `${project.github.owner}/${project.github.repo}:${project.github.enabled}` : "beacon"}
      integrationPanel={can((userMembership?.roleInProject ?? "VIEWER") as ProjectRole, "project:github", session.user.role as GlobalRole) && <GitHubConnectionPanel projectId={project.id} connection={project.github} incomingPending={incomingPending} pending={pending.length} errors={pending.filter(i => i.githubSync?.lastError).map(i => ({ key: `${project.key}-${i.number}`, message: i.githubSync!.lastError! }))} />}
      project={{
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
      }}
      initialIssues={issues}
      members={members}
      customStatuses={customStatuses}
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
