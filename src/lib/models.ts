export type ChatModel = {
  id: string;
  label: string;
  hint: string;
  tier: "fast" | "balanced" | "smart";
};

// All chat models routed through the AI Gateway.
export const CHAT_MODELS: ChatModel[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", hint: "Fast · default", tier: "fast" },
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", hint: "Faster reasoning", tier: "fast" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Big context", tier: "smart" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", hint: "Strongest Google", tier: "smart" },
  { id: "openai/gpt-5", label: "GPT-5", hint: "Powerful all-rounder", tier: "smart" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", hint: "Balanced OpenAI", tier: "balanced" },
  { id: "openai/gpt-5.4", label: "GPT-5.4", hint: "Advanced reasoning", tier: "smart" },
  { id: "openai/gpt-5.5", label: "GPT-5.5", hint: "Frontier", tier: "smart" },
];

export const DEFAULT_MODEL = CHAT_MODELS[0].id;

export function isValidModel(id: string | undefined | null): id is string {
  return !!id && CHAT_MODELS.some((m) => m.id === id);
}
