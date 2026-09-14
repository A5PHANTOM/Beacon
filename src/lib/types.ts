export type GlobalRole = "ADMIN" | "MEMBER";

export type ProjectRole = "LEAD" | "DEVELOPER" | "QA" | "VIEWER";

export type IssueStatus =
  | "OPEN"
  | "READY_FOR_DEV"
  | "DEV_IN_PROGRESS"
  | "DEV_REVIEW"
  | "DEV_COMPLETED"
  | "DEV_DEPLOYED"
  | "QA_IN_PROGRESS"
  | "QA_DEPLOYED"
  | "READY_FOR_RELEASE"
  | "PROD_DEPLOYED"
  | "CLOSED"
  | "INVALID"
  | "REPORTED"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "FIXED"
  | "VERIFIED"
  | "REJECTED";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type LinkType = "DUPLICATE" | "BLOCKS" | "RELATES_TO" | "CHILD_OF";
