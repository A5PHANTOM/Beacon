import type { GlobalRole, ProjectRole } from "./types";

export type ProjectAction =
  | "project:github"
  | "issue:create"
  | "issue:update"
  | "issue:delete"
  | "project:manage"
  | "project:assign_members";

const permissions: Record<ProjectAction, readonly ProjectRole[]> = {
  "project:github": ["LEAD", "DEVELOPER"],
  "issue:create": ["LEAD", "DEVELOPER", "QA"],
  "issue:update": ["LEAD", "DEVELOPER", "QA"],
  "issue:delete": ["LEAD"],
  "project:manage": ["LEAD"],
  "project:assign_members": ["LEAD"],
};

export function can(
  role: ProjectRole,
  action: ProjectAction,
  globalRole?: GlobalRole
): boolean {
  if (globalRole === "ADMIN") {
    return true;
  }
  return permissions[action]?.includes(role) ?? false;
}
