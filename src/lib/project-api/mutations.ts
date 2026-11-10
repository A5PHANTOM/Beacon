import { prisma } from "@/lib/db";
import { ApiError, authorizeMutation, requireProjectIssue, type ApiActor } from "./auth";
import { mutationSchema } from "./validation";
import { apiSession } from "./context";
import * as issues from "@/app/(dashboard)/projects/[id]/actions";
import * as projects from "@/app/(dashboard)/projects/actions";
import { saveProjectNotesAction } from "@/app/(dashboard)/projects/notes-actions";
import * as timesheets from "@/app/(dashboard)/timesheets/actions";
import * as github from "@/app/(dashboard)/projects/[id]/github-actions";
import * as statuses from "@/app/(dashboard)/admin/statuses/actions";

export async function mutateProject(actor: ApiActor, input: unknown) {
  const body = mutationSchema.parse(input);
  const projectId = actor.token.projectId;
  const adminActions = ["assign_member", "remove_member", "create_status", "delete_status"];
  const management = [...adminActions, "save_notes", "delete_project"];
  authorizeMutation(actor, body.action.includes("github") ? "project:github" : management.includes(body.action) ? "project:manage" : body.action === "create_issue" ? "issue:create" : "issue:update");
  if (adminActions.includes(body.action) && actor.token.user.role !== "ADMIN") throw new ApiError(403, "Administrator access is required.");
  if ("issueId" in body) await requireProjectIssue(projectId, body.issueId);
  if (body.action === "delete_attachment") {
    if (!await prisma.attachment.findFirst({ where: { id: body.attachmentId, issue: { projectId } }, select: { id: true } })) throw new ApiError(404, "Attachment not found in this project.");
  }
  if (body.action === "create_timesheet" || body.action === "update_timesheet") {
    if (body.entry.issueId) await requireProjectIssue(projectId, body.entry.issueId);
  }
  if (body.action === "update_timesheet" || body.action === "delete_timesheet") {
    const id = body.action === "update_timesheet" ? body.entry.id : body.id;
    if (!await prisma.timesheetEntry.findFirst({ where: { id, projectId }, select: { id: true } })) throw new ApiError(404, "Timesheet not found in this project.");
  }
  if (body.action === "delete_status" && !await prisma.customStatus.findFirst({ where: { id: body.id, projectId }, select: { id: true } })) throw new ApiError(404, "Project status not found. Global statuses cannot be deleted here.");
  return apiSession.run(actor.session, async () => {
    switch (body.action) {
      case "create_issue": return issues.createIssueAction({ ...body, projectId });
      case "update_issue": return issues.updateIssueDetailsAction(body.issueId, body.updates);
      case "update_status": return issues.updateIssueStatusAction(body.issueId, body.status, body.notes);
      case "add_comment": return issues.addCommentAction(body.issueId, body.body);
      case "add_attachments": return issues.addIssueAttachmentsAction({ ...body, projectId });
      case "delete_attachment": return issues.deleteIssueAttachmentFromProjectAction(body.attachmentId, projectId);
      case "save_notes": return saveProjectNotesAction({ projectId, notes: body.notes, contacts: JSON.stringify(body.contacts), credentials: JSON.stringify(body.credentials) });
      case "assign_member": return projects.assignProjectMemberAction({ ...body, projectId });
      case "remove_member": return projects.removeProjectMemberAction(projectId, body.userId);
      case "delete_project": return projects.deleteProjectAction({ projectId });
      case "create_timesheet": return timesheets.createTaskSlotAction({ ...body.entry, projectId });
      case "update_timesheet": return timesheets.updateTaskSlotAction({ ...body.entry, projectId });
      case "delete_timesheet": return timesheets.deleteTaskSlotAction({ id: body.id });
      case "connect_github": return github.connectGitHubAction({ ...body.connection, projectId });
      case "disconnect_github": return github.disconnectGitHubAction({ projectId });
      case "retry_github_sync": return github.retryGitHubSyncAction({ projectId });
      case "enable_github_updates": return github.enableGitHubUpdatesAction({ projectId });
      case "retry_github_updates": return github.retryGitHubUpdatesAction({ projectId });
      case "create_status": return statuses.createCustomStatusAction({ ...body, projectId });
      case "delete_status": return statuses.deleteCustomStatusAction(body.id);
      case "analyze_issue": return issues.analyzeIssueWithAIAction({ ...body, projectId });
    }
  });
}
