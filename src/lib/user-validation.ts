import { z } from "zod";
export const userEmailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254, "Email address is too long.");
export const resetUserEmailSchema = z.object({
  userId: z.string().min(1).max(100),
  email: userEmailSchema,
  expectedEmail: userEmailSchema,
}).strict();
