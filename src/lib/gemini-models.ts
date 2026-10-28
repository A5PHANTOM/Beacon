export type GeminiModelItem = {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  tag?: string;
  badgeColor?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
};

export const DEFAULT_GEMINI_MODELS: GeminiModelItem[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    displayName: "Gemini 2.5 Flash",
    tag: "Recommended",
    badgeColor: "#10b981",
    description: "Ultra-fast multimodal reasoning, 1M context. Ideal balance of speed & quality for bug tracking and screenshot OCR.",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    displayName: "Gemini 2.5 Pro",
    tag: "Deep Reasoning",
    badgeColor: "#6366f1",
    description: "Advanced cognitive reasoning for complex stack traces, deep root-cause diagnosis, and architectural bugs.",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    displayName: "Gemini 2.5 Flash-Lite",
    tag: "Fast & Light",
    badgeColor: "#06b6d4",
    description: "Lightweight & low-latency model for instant triage and high-volume ticket logging.",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    displayName: "Gemini 2.0 Flash",
    tag: "Multimodal",
    badgeColor: "#8b5cf6",
    description: "Next-gen multimodal workhorse model with strong visual reasoning capabilities.",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    displayName: "Gemini 1.5 Flash",
    tag: "Standard",
    badgeColor: "#64748b",
    description: "Fast, versatile workhorse model with 1M token context window.",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    displayName: "Gemini 1.5 Pro",
    tag: "High Intelligence",
    badgeColor: "#d97706",
    description: "2M token context window for large documentation and long code reviews.",
  },
];

export function formatModelDisplayName(modelId?: string): string {
  if (!modelId) return "Gemini 2.5 Flash";
  const match = DEFAULT_GEMINI_MODELS.find((m) => m.id === modelId);
  if (match) return match.name;
  return modelId
    .replace(/^models\//, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
