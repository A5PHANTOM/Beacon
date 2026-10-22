import { z } from "zod";

export const aiIssueAnalysisSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  category: z.enum(["UI", "BACKEND", "AI"]).default("UI"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  description: z.string().default(""),
  stepsToReproduce: z.string().default(""),
  expected: z.string().default(""),
  actual: z.string().default(""),
  environment: z.string().default(""),
  inferredFields: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  discrepancies: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([]),
});

export type AIIssueAnalysis = z.infer<typeof aiIssueAnalysisSchema>;

export type ImageInput = {
  filename: string;
  fileUrl: string; // data URL: data:image/...;base64,...
  size?: number;
};

export type AIProviderConfig = {
  provider: "gemini" | "openai" | "anthropic" | "groq" | "openrouter" | "custom";
  apiKey: string;
  model?: string;
  baseUrl?: string;
};

/**
 * Detect available AI provider from environment variables
 */
export function getAvailableAIConfig(): AIProviderConfig | null {
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      baseUrl: process.env.OPENAI_BASE_URL,
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.2-11b-vision-preview",
    };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
    };
  }
  if (process.env.AI_API_KEY) {
    return {
      provider: "custom",
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL || "gpt-4o-mini",
      baseUrl: process.env.AI_BASE_URL,
    };
  }
  return null;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: "image/jpeg", base64: dataUrl };
}

const SYSTEM_PROMPT = `You are Beacon's Senior QA Bug Analysis Assistant.
Beacon is an engineering defect tracker. Your mission is to assist testers by analyzing their bug descriptions and screenshot evidence to produce a structured, high-accuracy defect report.

CRITICAL INSTRUCTIONS & ACCURACY STANDARDS:
1. ONLY infer what is reasonably supported by the user's description, screenshots, and provided application context.
2. Distinguish OBSERVED FACTS from ASSUMPTIONS:
   - If the tester describes a behavior or screenshot shows an error banner, that is an observed fact.
   - If you infer the root cause or category without explicit evidence, explicitly list it under "assumptions" and mark it in "inferredFields".
3. NEVER invent console errors, HTTP status codes (e.g. 500, 404), stack traces, or root causes unless they are explicitly visible in the screenshot or explicitly written by the tester.
4. Treat screenshots as photographic evidence:
   - Note visible UI elements, text, error dialogs, URL bar, broken layouts, or truncated text.
   - Do not claim an event happened off-screen if it cannot be verified.
5. DISCREPANCY DETECTION:
   - If the tester's text says one thing (e.g. "Payment failed on Mobile Safari") but the screenshot shows something else (e.g. Desktop Chrome desktop screen, or payment succeeded), do NOT silently pick one. Flag it explicitly in the "discrepancies" array.
6. VALID SCHEMA VALUES:
   - "category": MUST be exactly one of: "UI" | "BACKEND" | "AI".
     * "UI": Visual bugs, css issues, broken layout, frontend form validation, client-side rendering errors.
     * "BACKEND": Server errors, API failures, missing data, 5xx responses, webhook drops, database sync issues.
     * "AI": Hallucinations, incorrect model responses, prompt injection, AI pipeline timeouts, model schema mismatches.
   - "priority": MUST be exactly one of: "LOW" | "MEDIUM" | "HIGH" | "URGENT".
     * Default to "MEDIUM" if severity cannot be definitively established.
     * "URGENT": Total blocker, data loss, security flaw, checkout broken for all users.
     * "HIGH": Major feature broken, no simple workaround.
     * "MEDIUM": Moderate defect, feature impaired but partial workaround exists.
     * "LOW": Cosmetic, minor alignment, typo, slight styling inconsistency.
7. MISSING DETAILS & FOLLOW-UP QUESTIONS:
   - If crucial information is missing (such as exact steps, browser version, user account role, or device environment), identify them in "missingInformation" and formulate 1 to 3 targeted, concise "followUpQuestions".
8. OUTPUT FORMAT:
   - Return PURE JSON conforming strictly to this JSON schema:
{
  "title": "Concise, descriptive bug summary (< 100 characters)",
  "category": "UI" | "BACKEND" | "AI",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "description": "Clear overview of the defect and impact",
  "stepsToReproduce": "Numbered step-by-step reproduction instructions:\\n1. ...\\n2. ...\\n3. ...",
  "expected": "What should have happened according to standard expectations",
  "actual": "What actually occurred (as observed in screenshot/description)",
  "environment": "OS, browser, app version, or screen dimensions if visible or noted, else empty string",
  "inferredFields": ["field names that were inferred rather than explicitly provided"],
  "assumptions": ["Assumptions made during analysis"],
  "discrepancies": ["Any detected conflicts between text description and screenshot evidence"],
  "missingInformation": ["Crucial details missing from the report"],
  "followUpQuestions": ["Focused questions for the tester to verify"]
}`;

/**
 * Call vision-capable AI provider with user description and uploaded images
 */
export async function analyzeIssueWithAI(params: {
  description: string;
  images: ImageInput[];
  projectContext?: { key: string; name: string };
  config?: AIProviderConfig | null;
}): Promise<AIIssueAnalysis> {
  const { description, images, projectContext } = params;
  const config = params.config || getAvailableAIConfig();

  if (!config || !config.apiKey) {
    throw new Error(
      "AI service is not configured. Please add GEMINI_API_KEY or OPENAI_API_KEY to your .env file, or configure an API key in the AI Assistant settings."
    );
  }

  const userContextNote = projectContext
    ? `\nProject Context: Issue is being reported in project "${projectContext.name}" [Key: ${projectContext.key}].`
    : "";

  const userMessageText = `Tester Defect Description:\n"""\n${description.trim()}\n"""${userContextNote}\n\nEvidence: ${images.length} screenshot(s) attached.\n\nPlease analyze both the tester's text description and the screenshot images together. Produce the structured defect report conforming to the JSON schema.`;

  let rawJsonText = "";

  switch (config.provider) {
    case "gemini": {
      rawJsonText = await callGeminiVision(config, userMessageText, images);
      break;
    }
    case "openai":
    case "groq":
    case "openrouter":
    case "custom": {
      rawJsonText = await callOpenAICompatibleVision(config, userMessageText, images);
      break;
    }
    case "anthropic": {
      rawJsonText = await callAnthropicVision(config, userMessageText, images);
      break;
    }
    default:
      throw new Error(`Unsupported AI provider: ${(config as any).provider}`);
  }

  // Parse and validate the response against Zod schema
  return parseAndValidateAIResponse(rawJsonText);
}

/**
 * Call Google Gemini API (gemini-1.5-flash / gemini-2.0-flash)
 */
async function callGeminiVision(
  config: AIProviderConfig,
  prompt: string,
  images: ImageInput[]
): Promise<string> {
  const model = config.model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    config.apiKey
  )}`;

  const parts: any[] = [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }];

  for (const img of images) {
    if (img.fileUrl) {
      const { mimeType, base64 } = parseDataUrl(img.fileUrl);
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64,
        },
      });
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMsg = `Gemini API error (Status ${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) {
        errorMsg = `Gemini API: ${parsed.error.message}`;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response content received from Gemini model.");
  }

  return text;
}

/**
 * Call OpenAI-compatible vision endpoint (OpenAI, Groq, OpenRouter, Custom)
 */
async function callOpenAICompatibleVision(
  config: AIProviderConfig,
  prompt: string,
  images: ImageInput[]
): Promise<string> {
  let defaultBaseUrl = "https://api.openai.com/v1";
  if (config.provider === "groq") defaultBaseUrl = "https://api.groq.com/openai/v1";
  if (config.provider === "openrouter") defaultBaseUrl = "https://openrouter.ai/api/v1";

  const baseUrl = config.baseUrl || defaultBaseUrl;
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const model = config.model || (config.provider === "groq" ? "llama-3.2-11b-vision-preview" : "gpt-4o-mini");

  const content: any[] = [{ type: "text", text: prompt }];

  for (const img of images) {
    if (img.fileUrl) {
      content.push({
        type: "image_url",
        image_url: {
          url: img.fileUrl,
          detail: "high",
        },
      });
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMsg = `AI API error (Status ${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) {
        errorMsg = `AI API: ${parsed.error.message}`;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("No response message received from AI model.");
  }

  return text;
}

/**
 * Call Anthropic Claude Vision API
 */
async function callAnthropicVision(
  config: AIProviderConfig,
  prompt: string,
  images: ImageInput[]
): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";
  const model = config.model || "claude-3-5-sonnet-20241022";

  const content: any[] = [];

  for (const img of images) {
    if (img.fileUrl) {
      const { mimeType, base64 } = parseDataUrl(img.fileUrl);
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as any,
          data: base64,
        },
      });
    }
  }

  content.push({
    type: "text",
    text: `${prompt}\n\nRespond ONLY with valid JSON conforming to the requested schema, without backticks or markdown fences.`,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      max_tokens: 2048,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMsg = `Anthropic API error (Status ${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) {
        errorMsg = `Anthropic API: ${parsed.error.message}`;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error("No response content received from Claude model.");
  }

  return text;
}

/**
 * Clean and validate model response against Zod schema
 */
function parseAndValidateAIResponse(rawText: string): AIIssueAnalysis {
  let cleaned = rawText.trim();
  // Strip markdown code fences if present (e.g. ```json ... ```)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    // Attempt extracting first JSON object from substring
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new Error("AI response could not be parsed as valid JSON: " + (err instanceof Error ? err.message : "SyntaxError"));
      }
    } else {
      throw new Error("AI did not return a valid JSON object.");
    }
  }

  const validation = aiIssueAnalysisSchema.safeParse(parsed);
  if (!validation.success) {
    const errorDetails = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`AI generated invalid issue format (${errorDetails})`);
  }

  return validation.data;
}
