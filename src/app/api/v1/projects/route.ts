import { authenticateApi } from "@/lib/project-api/auth";
import { readProject } from "@/lib/project-api/reads";
import { json, apiFailure, apiHeaders } from "@/lib/project-api/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A project key discovers only its own project, including for administrators.
export async function GET(request: Request) {
  try {
    const actor = await authenticateApi(request);
    return json({ success: true, data: [await readProject(actor, new URLSearchParams())] });
  } catch (error) { return apiFailure(error); }
}
export function OPTIONS() { return new Response(null, { status: 204, headers: apiHeaders }); }
