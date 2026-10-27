import { z } from "zod";
import { prisma } from "./db";
import { decryptGitHubToken, githubRequest } from "./github-api";

export type AssignableDeveloper = { userId: string; name: string; email: string; roleInProject: string; githubId: string | null; githubLogin: string | null };
export type ProjectAssignees = { mode: "beacon" | "github"; developers: AssignableDeveloper[] };
const githubUser = z.object({ id: z.number().int().positive(), login: z.string().min(1).max(100) });

// Internal data access: callers must authorize the requester before using this helper.
// Match immutable GitHub IDs, not public emails or editable username strings.
export async function getAssignableDevelopers(projectId: string): Promise<ProjectAssignees> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: {
    github: true,
    members: { where: { roleInProject: "DEVELOPER" }, select: { userId: true, roleInProject: true, user: { select: { name: true, email: true, githubId: true, githubLogin: true } } } },
  } });
  if (!project) throw new Error("Project not found.");
  const developers = project.members.map(member => ({ userId: member.userId, roleInProject: member.roleInProject, ...member.user }));
  if (!project.github?.enabled) return { mode: "beacon", developers };
  const connection = project.github;
  const token = decryptGitHubToken(connection.encryptedToken);
  const available = new Map<string, string>();
  const started = Date.now();
  for (let page = 1; page <= 10; page++) {
    if (Date.now() - started > 20000) throw new Error("GitHub assignee lookup timed out. Please refresh and retry.");
    const users = z.array(githubUser).parse(await githubRequest(token, `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/assignees?per_page=100&page=${page}`));
    for (const user of users) available.set(String(user.id), user.login);
    if (users.length < 100) break;
    if (page === 10) throw new Error("GitHub assignee list is too large to load completely. No partial list was used.");
  }
  return { mode: "github", developers: developers.filter(user => user.githubId && available.has(user.githubId)).map(user => ({ ...user, githubLogin: available.get(user.githubId!)! })) };
}

export async function validateProjectAssignee(projectId: string, assigneeId: string) {
  // Cheap membership check first: forged cross-project IDs must never reach GitHub.
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: assigneeId } } });
  if (member?.roleInProject !== "DEVELOPER") throw new Error("Assignee must be a developer in this Beacon project.");
  const result = await getAssignableDevelopers(projectId);
  const user = result.developers.find(developer => developer.userId === assigneeId);
  if (!user) throw new Error("This developer is not assignable in the connected GitHub repository. They must sign in with GitHub and have repository access. Refresh the list and try again.");
  return user;
}
