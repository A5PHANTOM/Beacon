export type GlobalRole = "ADMIN" | "MEMBER";

export type ProjectRole = "LEAD" | "DEVELOPER" | "QA" | "VIEWER";

export type IssueStatus =
  | "REPORTED"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "FIXED"
  | "VERIFIED"
  | "CLOSED"
  | "REJECTED";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type LinkType = "DUPLICATE" | "BLOCKS" | "RELATES_TO" | "CHILD_OF";
