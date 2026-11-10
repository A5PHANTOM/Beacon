import { z } from "zod";
export const projectApiKeySchema = z.object({
  projectId: z.string().min(1).max(100),
  name: z.string().trim().min(1, "Enter a key name.").max(80),
  access: z.enum(["READ", "WRITE"]),
  days: z.number().int().min(1).max(365),
}).strict();
