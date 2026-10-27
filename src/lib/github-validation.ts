import { z } from "zod";
const repositoryPart = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, "Use a GitHub owner or repository name").refine(value => value !== "." && value !== "..", "Invalid repository name");
export const githubConnectionSchema = z.object({ projectId: z.string().min(1), owner: repositoryPart, repo: repositoryPart, token: z.string().trim().min(1, "Enter a GitHub token").max(500) });
export const githubProjectSchema = z.object({ projectId: z.string().min(1) });
