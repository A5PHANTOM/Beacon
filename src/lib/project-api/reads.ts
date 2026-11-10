import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, type ApiActor, requireProjectIssue } from "./auth";
import { readSchema, mutationSchema } from "./validation";
import { allowedTransitions } from "@/lib/workflow";
import { getProjectAssigneesAction } from "@/app/(dashboard)/projects/[id]/assignee-actions";
import { apiSession } from "./context";
const user = { id: true, name: true, email: true } as const;

export async function readProject(actor: ApiActor, params: URLSearchParams) {
  const query = readSchema.parse(Object.fromEntries(params));
  const projectId = actor.token.projectId;
  const page = { take: query.limit + 1, ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}), orderBy: { id: "asc" as const } };
  const paged = <T extends { id: string }>(rows: T[]) => ({ items: rows.slice(0, query.limit), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null });
  switch (query.resource) {
    case "schema": return { mutations: z.toJSONSchema(mutationSchema), reads: z.toJSONSchema(readSchema), allowedTransitions };
    case "project": {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, key: true, name: true, description: true, createdAt: true, updatedAt: true, createdById: true, _count: { select: { issues: true, members: true } }, github: { select: { owner: true, repo: true, enabled: true, inboundEnabled: true, lastWebhookAt: true } } } });
      if (!project) throw new ApiError(404, "Project not found.");
      return { ...project, resources: readSchema.shape.resource.unwrap().options, apiPath: `/api/v1/projects/${projectId}` };
    }
    case "issues": return paged(await prisma.issue.findMany({ where: { projectId, ...(query.status ? { status: query.status } : {}), ...(query.severity ? { severity: query.severity } : {}), ...(query.priority ? { priority: query.priority } : {}), ...(query.query ? { OR: [{ title: { contains: query.query } }, { description: { contains: query.query } }] } : {}) }, ...page, include: { reporter: { select: user }, assignee: { select: user } } }));
    case "issue": {
      if (!query.issueId) throw new ApiError(400, "issueId is required.");
      await requireProjectIssue(projectId, query.issueId);
      return prisma.issue.findFirst({ where: { id: query.issueId, projectId }, include: {
        reporter: { select: user }, assignee: { select: user },
        comments: { include: { user: { select: user } }, orderBy: { createdAt: "asc" } },
        attachments: { orderBy: { uploadedAt: "asc" } }, history: { include: { user: { select: user } }, orderBy: { changedAt: "asc" } },
        outgoingLinks: { where: { linkedIssue: { projectId } } }, incomingLinks: { where: { issue: { projectId } } },
        githubSync: { select: { number: true, assignmentSynced: true, syncedAt: true, lastConfirmedStatus: true } },
      } });
    }
    case "members": return prisma.projectMember.findMany({ where: { projectId }, select: { userId: true, roleInProject: true, user: { select: user } }, orderBy: { userId: "asc" } });
    case "notes": return prisma.project.findUnique({ where: { id: projectId }, select: { notes: true, contacts: true, credentials: true } });
    case "statuses": return { allowedTransitions, custom: await prisma.customStatus.findMany({ where: { OR: [{ projectId }, { projectId: null }] }, orderBy: [{ order: "asc" }, { id: "asc" }] }) };
    case "timesheets": return paged(await prisma.timesheetEntry.findMany({ where: { projectId, ...(actor.token.user.role === "ADMIN" ? {} : { userId: actor.token.userId }) }, ...page }));
    case "notifications": return paged(await prisma.notification.findMany({ where: { userId: actor.token.userId, issueId: { in: (await prisma.issue.findMany({ where: { projectId }, select: { id: true } })).map(i => i.id) } }, ...page }));
    case "analytics": return { statuses: await prisma.issue.groupBy({ by: ["status"], where: { projectId }, _count: true }), priorities: await prisma.issue.groupBy({ by: ["priority"], where: { projectId }, _count: true }), severities: await prisma.issue.groupBy({ by: ["severity"], where: { projectId }, _count: true }) };
    case "assignees": {
      const result = await apiSession.run(actor.session, () => getProjectAssigneesAction({ projectId }));
      if (!result.success) throw new ApiError(400, "Could not load assignable developers.");
      return result.data;
    }
  }
}
