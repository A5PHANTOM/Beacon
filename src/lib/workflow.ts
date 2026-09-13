import type { IssueStatus } from "./types";

export { type IssueStatus } from "./types";

export const issueStatuses: readonly IssueStatus[] = [
  "REPORTED",
  "TRIAGED",
  "IN_PROGRESS",
  "FIXED",
  "VERIFIED",
  "CLOSED",
  "REJECTED",
];

export const allowedTransitions: Record<IssueStatus, readonly IssueStatus[]> = {
  REPORTED: ["IN_PROGRESS", "FIXED", "REJECTED", "TRIAGED"],
  TRIAGED: ["IN_PROGRESS", "FIXED", "REJECTED", "REPORTED"],
  IN_PROGRESS: ["FIXED", "REJECTED", "TRIAGED"],
  FIXED: ["IN_PROGRESS", "VERIFIED", "REJECTED"],
  VERIFIED: ["CLOSED", "IN_PROGRESS", "REJECTED"],
  CLOSED: ["IN_PROGRESS"],
  REJECTED: ["IN_PROGRESS", "CLOSED"],
};

export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}
