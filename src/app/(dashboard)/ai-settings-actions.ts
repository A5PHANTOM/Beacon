"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const saveAiSettingsSchema = z.object({
  geminiApiKey: z.string().trim().min(5, "API key must be at least 5 characters"),
  aiUsageLimit: z.number().min(1).max(10000).default(50),
});

/**
 * Fetch the current user's AI settings & usage
 */
export async function getUserAISettingsAction() {
  try {
    const session = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        geminiApiKey: true,
        aiUsageCount: true,
        aiUsageLimit: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const hasCustomKey = Boolean(user.geminiApiKey && user.geminiApiKey.length > 5);
    const hasServerFallback = Boolean(process.env.GEMINI_API_KEY);
    const hasKey = hasCustomKey || hasServerFallback;

    let maskedKey = "";
    if (hasCustomKey && user.geminiApiKey) {
      const len = user.geminiApiKey.length;
      maskedKey = `${user.geminiApiKey.slice(0, 6)}...${user.geminiApiKey.slice(-4)}`;
    } else if (hasServerFallback) {
      maskedKey = "Server Configured (.env)";
    }

    return {
      success: true,
      data: {
        hasKey,
        hasCustomKey,
        hasServerFallback,
        maskedKey,
        aiUsageCount: user.aiUsageCount || 0,
        aiUsageLimit: user.aiUsageLimit || 50,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load AI settings";
    return { success: false, error: message };
  }
}

/**
 * Test a Gemini API key against Google Generative Language API
 */
export async function testGeminiApiKeyAction(apiKey: string) {
  try {
    await requireAuth();
    const key = apiKey.trim();
    if (!key) {
      return { success: false, error: "Please enter an API key to test." };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
    );

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      let errorMsg = `Invalid API key (Status ${res.status})`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        }
      } catch {}
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    const availableModels = data.models ? data.models.length : 0;
    return {
      success: true,
      message: `API Key is valid! Connected to Google Gemini (${availableModels} models available).`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to verify API key with Google";
    return { success: false, error: message };
  }
}

/**
 * Save or update user's Gemini API key & usage limit in DB
 */
export async function updateUserAISettingsAction(data: z.infer<typeof saveAiSettingsSchema>) {
  try {
    const session = await requireAuth();
    const parsed = saveAiSettingsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid API key data",
      };
    }

    const { geminiApiKey, aiUsageLimit } = parsed.data;

    // Verify key with Google before persisting
    const testResult = await testGeminiApiKeyAction(geminiApiKey);
    if (!testResult.success) {
      return {
        success: false,
        error: testResult.error || "The provided Gemini API key could not be verified by Google.",
      };
    }

    // Persist to user record in DB
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        geminiApiKey,
        aiUsageLimit,
      },
    });

    revalidatePath("/projects");
    return {
      success: true,
      message: "Gemini API key and limit saved successfully to your Beacon account.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save AI settings";
    return { success: false, error: message };
  }
}

/**
 * Remove user's Gemini API key from DB
 */
export async function removeUserAISettingsAction() {
  try {
    const session = await requireAuth();
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        geminiApiKey: null,
      },
    });

    revalidatePath("/projects");
    return {
      success: true,
      message: "Gemini API key removed from your account.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove API key";
    return { success: false, error: message };
  }
}

/**
 * Reset usage counter for the user
 */
export async function resetUserAIUsageCountAction() {
  try {
    const session = await requireAuth();
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        aiUsageCount: 0,
      },
    });

    revalidatePath("/projects");
    return {
      success: true,
      message: "AI usage counter reset to 0.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset usage count";
    return { success: false, error: message };
  }
}
