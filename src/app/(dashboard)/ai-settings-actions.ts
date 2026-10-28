"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { DEFAULT_GEMINI_MODELS, type GeminiModelItem } from "@/lib/gemini-models";

const saveAiSettingsSchema = z.object({
  geminiApiKey: z.string().trim().optional().or(z.literal("")),
  geminiModel: z.string().trim().min(1, "Please select or enter a valid model").default("gemini-2.5-flash"),
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
      maskedKey = `${user.geminiApiKey.slice(0, 6)}...${user.geminiApiKey.slice(-4)}`;
    } else if (hasServerFallback) {
      maskedKey = "Server Configured (.env)";
    }

    // Read chosen model from secure long-lived cookie (keeps DB untouched)
    const cookieStore = await cookies();
    const geminiModel =
      cookieStore.get("beacon_gemini_model")?.value ||
      process.env.GEMINI_MODEL ||
      "gemini-2.5-flash";

    return {
      success: true,
      data: {
        hasKey,
        hasCustomKey,
        hasServerFallback,
        maskedKey,
        geminiModel,
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
 * Test a Gemini API key against Google Generative Language API and discover available models
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
    const rawModels: any[] = Array.isArray(data.models) ? data.models : [];
    const validModels = rawModels
      .filter((m) => {
        const methods = m.supportedGenerationMethods || [];
        return methods.includes("generateContent") && m.name?.toLowerCase().includes("gemini");
      })
      .map((m) => {
        const cleanId = m.name.replace(/^models\//, "");
        const matchedDefault = DEFAULT_GEMINI_MODELS.find((d) => d.id === cleanId);
        return {
          id: cleanId,
          name: cleanId,
          displayName: m.displayName || matchedDefault?.name || cleanId,
          description: m.description || matchedDefault?.description || "",
          tag: matchedDefault?.tag || (cleanId.includes("pro") ? "Pro" : cleanId.includes("flash") ? "Flash" : "Model"),
          badgeColor: matchedDefault?.badgeColor || (cleanId.includes("pro") ? "#6366f1" : "#10b981"),
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
        };
      });

    return {
      success: true,
      message: `API Key verified! Connected to Google Gemini (${validModels.length || rawModels.length} models available).`,
      models: validModels.length > 0 ? validModels : DEFAULT_GEMINI_MODELS,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to verify API key with Google";
    return { success: false, error: message };
  }
}

/**
 * Fetch available Gemini models (from Google API if key is present, otherwise defaults)
 */
export async function getAvailableGeminiModelsAction(apiKey?: string) {
  try {
    const session = await requireAuth();
    let keyToUse = apiKey?.trim();

    if (!keyToUse) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { geminiApiKey: true },
      });
      keyToUse = user?.geminiApiKey || process.env.GEMINI_API_KEY || "";
    }

    if (!keyToUse) {
      return {
        success: true,
        data: DEFAULT_GEMINI_MODELS,
        source: "default" as const,
      };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keyToUse)}`
    );

    if (!res.ok) {
      return {
        success: true,
        data: DEFAULT_GEMINI_MODELS,
        source: "default" as const,
      };
    }

    const json = await res.json();
    const rawModels: any[] = Array.isArray(json.models) ? json.models : [];

    const validModels: GeminiModelItem[] = rawModels
      .filter((m) => {
        const methods = m.supportedGenerationMethods || [];
        return methods.includes("generateContent") && m.name?.toLowerCase().includes("gemini");
      })
      .map((m) => {
        const cleanId = m.name.replace(/^models\//, "");
        const matchedDefault = DEFAULT_GEMINI_MODELS.find((d) => d.id === cleanId);
        return {
          id: cleanId,
          name: cleanId,
          displayName: m.displayName || matchedDefault?.name || cleanId,
          description: m.description || matchedDefault?.description || "",
          tag: matchedDefault?.tag || (cleanId.includes("pro") ? "Pro" : cleanId.includes("flash") ? "Flash" : "Model"),
          badgeColor: matchedDefault?.badgeColor || (cleanId.includes("pro") ? "#6366f1" : "#10b981"),
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
        };
      });

    const priorityIds = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    const sorted = [
      ...priorityIds.map((pid) => validModels.find((m) => m.id === pid)).filter(Boolean) as GeminiModelItem[],
      ...validModels.filter((m) => !priorityIds.includes(m.id)),
    ];

    return {
      success: true,
      data: sorted.length > 0 ? sorted : DEFAULT_GEMINI_MODELS,
      source: "live" as const,
    };
  } catch {
    return {
      success: true,
      data: DEFAULT_GEMINI_MODELS,
      source: "default" as const,
    };
  }
}

/**
 * Save or update user's Gemini API key, model selection, & usage limit
 * Model is stored in a 1-year cookie so the production database schema remains untouched.
 */
export async function updateUserAISettingsAction(data: z.infer<typeof saveAiSettingsSchema>) {
  try {
    const session = await requireAuth();
    const parsed = saveAiSettingsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid AI settings",
      };
    }

    const { geminiApiKey, geminiModel, aiUsageLimit } = parsed.data;

    // Persist model in secure long-lived cookie (1 year)
    if (geminiModel) {
      const cookieStore = await cookies();
      cookieStore.set("beacon_gemini_model", geminiModel, {
        path: "/",
        maxAge: 31536000,
        sameSite: "lax",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { geminiApiKey: true },
    });

    const updateData: {
      geminiApiKey?: string;
      aiUsageLimit: number;
    } = {
      aiUsageLimit,
    };

    if (geminiApiKey && geminiApiKey.trim().length > 0) {
      const trimmedKey = geminiApiKey.trim();
      if (trimmedKey.length < 5) {
        return { success: false, error: "API key must be at least 5 characters" };
      }

      // Verify key with Google before persisting
      const testResult = await testGeminiApiKeyAction(trimmedKey);
      if (!testResult.success) {
        return {
          success: false,
          error: testResult.error || "The provided Gemini API key could not be verified by Google.",
        };
      }
      updateData.geminiApiKey = trimmedKey;
    } else if (!existingUser?.geminiApiKey && !process.env.GEMINI_API_KEY) {
      return {
        success: false,
        error: "Please enter your Gemini API key to activate AI features.",
      };
    }

    // Persist API key and usage limit to user record (existing DB columns only)
    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    revalidatePath("/projects");
    return {
      success: true,
      message: `Gemini settings updated! Model set to ${geminiModel}.`,
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
