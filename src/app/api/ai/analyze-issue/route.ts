import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeIssueWithAI, type AIProviderConfig } from "@/lib/ai";
import { z } from "zod";

export const dynamic = "force-dynamic";

const imageItemSchema = z.object({
  filename: z.string(),
  fileUrl: z.string(),
  size: z.number().default(0),
});

const requestSchema = z.object({
  projectId: z.string(),
  description: z.string().trim().default(""),
  images: z.array(imageItemSchema).max(10).default([]),
  apiKeyOverride: z.string().trim().optional(),
  providerOverride: z.enum(["gemini", "openai", "anthropic", "groq", "openrouter", "custom"]).optional(),
  modelOverride: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Check session or API key
    const session = await getServerAuthSession();
    let userId = session?.user?.id;
    let isAdmin = session?.user?.role === "ADMIN";

    if (!userId) {
      const apiKeyHeader = req.headers.get("x-beacon-api-key");
      const authHeader = req.headers.get("authorization");
      const expectedKey = process.env.BEACON_API_KEY || "beacon-mcp-secret-key-2026";
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : apiKeyHeader?.trim();

      if (token && token === expectedKey) {
        const adminUser = await prisma.user.findFirst({
          where: { OR: [{ email: "admin@gmail.com" }, { role: "ADMIN" }] },
        });
        if (adminUser) {
          userId = adminUser.id;
          isAdmin = true;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }

    const { projectId, description, images, apiKeyOverride, providerOverride, modelOverride } = parsed.data;

    if (!description && images.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide either a bug description or upload at least one screenshot." },
        { status: 400 }
      );
    }

    // Verify project access
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!isAdmin && !membership) {
      return NextResponse.json(
        { success: false, error: "Access denied: You are not a member of this project" },
        { status: 403 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, key: true },
    });

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    // Fetch user record for stored Gemini API key and usage limits
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { geminiApiKey: true, aiUsageCount: true, aiUsageLimit: true },
    });

    const userKey = apiKeyOverride || userRecord?.geminiApiKey;

    // Check usage limit if user has a limit configured
    if (userRecord && userRecord.aiUsageLimit > 0 && userRecord.aiUsageCount >= userRecord.aiUsageLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `AI usage limit reached (${userRecord.aiUsageCount}/${userRecord.aiUsageLimit} calls). You can update your limit or reset usage from AI Settings on the sidebar.`,
        },
        { status: 429 }
      );
    }

    // Read chosen model from cookie or env (keeps DB schema untouched)
    const cookieModel = req.cookies.get("beacon_gemini_model")?.value;
    const activeModel = modelOverride || cookieModel || process.env.GEMINI_MODEL || "gemini-2.5-flash";

    let customConfig: AIProviderConfig | null = null;
    if (userKey) {
      customConfig = {
        provider: providerOverride || "gemini",
        apiKey: userKey,
        model: activeModel,
      };
    }

    const analysis = await analyzeIssueWithAI({
      description,
      images,
      projectContext: { name: project.name, key: project.key },
      config: customConfig,
    });

    if (userRecord) {
      await prisma.user.update({
        where: { id: userId },
        data: { aiUsageCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ success: true, data: analysis });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to analyze issue";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
