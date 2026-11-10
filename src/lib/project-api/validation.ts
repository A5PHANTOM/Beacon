import { z } from "zod";
import { createTaskSlotSchema, updateTaskSlotSchema } from "@/lib/timesheet-types";
import { githubConnectionSchema } from "@/lib/github-validation";
const id = z.string().min(1).max(100);
const text = z.string().max(50000);
const image = z.object({ filename: z.string().min(1).max(255), fileUrl: z.url().refine(v => v.startsWith("https://"), "Attachment URLs must use HTTPS"), size: z.number().int().min(0).max(100000000) }).strict();
const fields = {
  title: z.string().trim().min(3).max(500), description: text, stepsToReproduce: text,
  expected: text.nullable(), actual: text.nullable(), environment: z.string().max(1000).nullable(),
  severity: z.enum(["UI", "BACKEND", "AI", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]), assigneeId: id.nullable(),
};
const action = <T extends string, S extends z.ZodRawShape>(name: T, shape: S) => z.object({ action: z.literal(name), ...shape }).strict();
export const mutationSchema = z.discriminatedUnion("action", [
  action("create_issue", { ...fields, description: text.optional(), stepsToReproduce: text.optional(), expected: text.optional(), actual: text.optional(), environment: text.optional(), severity: fields.severity.default("UI"), priority: fields.priority.default("MEDIUM"), assigneeId: id, images: z.array(image).max(10).optional() }),
  action("update_issue", { issueId: id, updates: z.object(fields).partial().strict().refine(v => Object.keys(v).length > 0, "Provide at least one field") }),
  action("update_status", { issueId: id, status: z.string().min(1).max(100), notes: z.string().max(10000).optional() }),
  action("add_comment", { issueId: id, body: text.trim().min(1) }),
  action("add_attachments", { issueId: id, images: z.array(image).min(1).max(10) }),
  action("delete_attachment", { attachmentId: id }),
  action("save_notes", { notes: text, contacts: z.array(z.object({ id: id, name: z.string(), email: z.string(), role: z.string().optional(), notes: z.string().optional() }).strict()).max(500), credentials: z.array(z.object({ id, title: z.string(), url: z.string().optional(), username: z.string().optional(), password: z.string().optional(), category: z.string().optional(), notes: z.string().optional() }).strict()).max(500) }),
  action("assign_member", { userId: id, roleInProject: z.enum(["LEAD", "DEVELOPER", "QA", "VIEWER"]) }),
  action("remove_member", { userId: id }),
  action("delete_project", {}),
  action("create_timesheet", { entry: createTaskSlotSchema.omit({ projectId: true }).strict() }),
  action("update_timesheet", { entry: updateTaskSlotSchema.omit({ projectId: true }).strict() }),
  action("delete_timesheet", { id }),
  action("connect_github", { connection: githubConnectionSchema.omit({ projectId: true }).strict() }),
  action("disconnect_github", {}), action("retry_github_sync", {}), action("enable_github_updates", {}), action("retry_github_updates", {}),
  action("create_status", { label: z.string().min(2).max(40), key: z.string().max(30).optional(), color: z.string().regex(/^#([\da-fA-F]{3}|[\da-fA-F]{6})$/), category: z.enum(["TODO", "IN_PROGRESS", "DONE", "INVALID"]), description: z.string().max(200).optional() }),
  action("delete_status", { id }),
  action("analyze_issue", { description: text, images: z.array(image).max(10).default([]) }),
]);
export const readSchema = z.object({
  resource: z.enum(["project", "issues", "issue", "members", "notes", "statuses", "timesheets", "notifications", "analytics", "assignees", "schema"]).default("project"),
  cursor: id.optional(), limit: z.coerce.number().int().min(1).max(100).default(50), issueId: id.optional(),
  query: z.string().max(500).optional(), status: z.string().max(100).optional(), severity: fields.severity.optional(), priority: fields.priority.optional(),
}).strict();
export const projectIdSchema = id;
