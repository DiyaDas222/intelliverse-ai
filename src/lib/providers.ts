// Provider registry types & client helpers.
// Provider rows live in `provider_configs` table; live "is the API key configured?"
// state comes from the server via providers.functions.ts (process.env check).

export type ProviderCategory = "native" | "chat" | "image" | "video" | "audio" | "multi";

export type ProviderRow = {
  id: string;
  name: string;
  category: ProviderCategory;
  env_vars: string[];
  enabled: boolean;
  notes: string | null;
  updated_at: string;
};

export type ProviderStatus = ProviderRow & {
  /** every required env var is present at runtime */
  configured: boolean;
  /** subset of env_vars that are missing */
  missing: string[];
};

export const CATEGORY_LABEL: Record<ProviderCategory, string> = {
  native: "Native (Lovable AI)",
  chat: "Chat / Text",
  image: "Image",
  video: "Video",
  audio: "Audio / Voice",
  multi: "Multi-modal Hub",
};
