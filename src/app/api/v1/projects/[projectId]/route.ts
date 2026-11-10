import { authenticateApi } from "@/lib/project-api/auth";
import { projectIdSchema } from "@/lib/project-api/validation";
import { readProject } from "@/lib/project-api/reads";
import { mutateProject } from "@/lib/project-api/mutations";
import { json, apiFailure, apiHeaders, readJson } from "@/lib/project-api/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const id = projectIdSchema.parse((await context.params).projectId);
    const actor = await authenticateApi(request, id);
    return json({ success: true, data: await readProject(actor, new URL(request.url).searchParams) });
  } catch (error) { return apiFailure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const id = projectIdSchema.parse((await context.params).projectId);
    const actor = await authenticateApi(request, id);
    const result = await mutateProject(actor, await readJson(request));
    if (!result.success) {
      const error = result.error ?? "Action failed.";
      // Legacy actions sometimes include database exception text: never expose it.
      if (/prisma|invocation|constraint|\n|stack|SQLITE/i.test(error)) return json({ success: false, error: "Action failed. Check the supplied values and permissions." }, 400);
      return json({ success: false, error }, /permission|denied|forbidden/i.test(error) ? 403 : 400);
    }
    return json(result);
  } catch (error) { return apiFailure(error); }
}
export function OPTIONS() { return new Response(null, { status: 204, headers: apiHeaders }); }
