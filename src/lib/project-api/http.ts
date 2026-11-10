import { z } from "zod";
import { ApiError } from "./auth";
export const apiHeaders = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" };
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: apiHeaders }); }
export function apiFailure(error: unknown) {
  if (error instanceof ApiError) return json({ success: false, error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ success: false, error: "Invalid request.", details: error.issues.map(i => ({ path: i.path, message: i.message })) }, 400);
  if (error instanceof SyntaxError) return json({ success: false, error: "Request body must be valid JSON." }, 400);
  return json({ success: false, error: "Beacon could not complete this request." }, 500);
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Use Content-Type: application/json.");
  // Bound the actual stream as well as Content-Length (which clients can omit).
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "JSON body required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024 * 1024) { await reader.cancel(); throw new ApiError(413, "Request exceeds 1 MB. Upload files separately and send HTTPS URLs."); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
