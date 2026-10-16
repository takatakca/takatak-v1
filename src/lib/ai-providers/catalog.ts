// AI provider keys — catalog (pure data, no I/O).
//
// The owner enters one API key per provider in Admin › AI provider keys. Keys
// are stored encrypted server-side (see ./store.ts) and never sent to a
// browser. Each provider below says how a key is checked: a cheap read-only
// request that proves the key works without generating anything or spending
// provider credits. Providers with no documented read-only endpoint can store
// a key but are never shown as "verified".
//
// Endpoints were checked against each provider's public documentation on
// 2026-10-09. Change them here only after re-checking the provider's docs.

import { AI_PROVIDERS } from "@/lib/growth/ai-engine";

export type AiProviderCategory = "text" | "voice" | "video" | "image" | "music" | "builder";

/** How the key is sent on the read-only check request. */
export type KeyCheck =
  | { kind: "http"; url: string; auth: "bearer" | { header: string }; extraHeaders?: Record<string, string> }
  | { kind: "anthropic_sdk" }
  | { kind: "none"; reason: string };

export interface AiProviderEntry {
  key: string;
  name: string;
  category: AiProviderCategory;
  /** Environment variable read when no key is saved in the panel. */
  env: string;
  /** False for tools the owner uses but cannot resell to clients as credits. */
  billableToClients: boolean;
  check: KeyCheck;
  note?: string;
}

const growthEnv = new Map(AI_PROVIDERS.map((p) => [p.key, p.env]));
function envFor(key: string, fallback: string): string {
  return growthEnv.get(key) ?? fallback;
}

export const AI_PROVIDER_CATALOG: AiProviderEntry[] = [
  {
    key: "anthropic",
    name: "Anthropic Claude",
    category: "text",
    env: envFor("anthropic", "ANTHROPIC_API_KEY"),
    billableToClients: true,
    check: { kind: "anthropic_sdk" },
  },
  {
    key: "openai",
    name: "OpenAI (ChatGPT)",
    category: "text",
    env: envFor("openai", "OPENAI_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.openai.com/v1/models", auth: "bearer" },
  },
  {
    key: "gemini",
    name: "Google Gemini",
    category: "text",
    env: envFor("gemini", "GEMINI_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", auth: { header: "x-goog-api-key" } },
  },
  {
    key: "xai",
    name: "xAI Grok",
    category: "text",
    env: envFor("xai", "XAI_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.x.ai/v1/models", auth: "bearer" },
  },
  {
    key: "mistral",
    name: "Mistral",
    category: "text",
    env: envFor("mistral", "MISTRAL_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.mistral.ai/v1/models", auth: "bearer" },
  },
  {
    key: "perplexity",
    name: "Perplexity",
    category: "text",
    env: envFor("perplexity", "PERPLEXITY_API_KEY"),
    billableToClients: true,
    check: { kind: "none", reason: "Perplexity has no documented read-only endpoint to check a key." },
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    category: "text",
    env: envFor("deepseek", "DEEPSEEK_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.deepseek.com/models", auth: "bearer" },
  },
  {
    key: "groq",
    name: "Groq (open models)",
    category: "text",
    env: envFor("groq", "GROQ_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.groq.com/openai/v1/models", auth: "bearer" },
  },
  {
    key: "cohere",
    name: "Cohere",
    category: "text",
    env: envFor("cohere", "COHERE_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.cohere.com/v1/models?page_size=1", auth: "bearer" },
  },
  {
    key: "elevenlabs",
    name: "ElevenLabs",
    category: "voice",
    env: envFor("elevenlabs", "ELEVENLABS_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.elevenlabs.io/v1/user", auth: { header: "xi-api-key" } },
  },
  {
    key: "runway",
    name: "Runway",
    category: "video",
    env: envFor("runway", "RUNWAYML_API_SECRET"),
    billableToClients: true,
    check: {
      kind: "http",
      url: "https://api.dev.runwayml.com/v1/organization",
      auth: "bearer",
      extraHeaders: { "X-Runway-Version": "2024-11-06" },
    },
  },
  {
    key: "heygen",
    name: "HeyGen",
    category: "video",
    env: envFor("heygen", "HEYGEN_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.heygen.com/v2/user/remaining_quota", auth: { header: "X-Api-Key" } },
  },
  {
    key: "twelvelabs",
    name: "Twelve Labs",
    category: "video",
    env: "TWELVELABS_API_KEY",
    billableToClients: true,
    check: { kind: "http", url: "https://api.twelvelabs.io/v1.3/indexes?page_limit=1", auth: { header: "x-api-key" } },
    note: "Video understanding and search.",
  },
  {
    key: "revid",
    name: "Revid",
    category: "video",
    env: "REVID_API_KEY",
    billableToClients: true,
    check: { kind: "none", reason: "Revid's API only exposes render calls, which spend credits, so the key is not checked automatically." },
    note: "Short-form video generation.",
  },
  {
    key: "stability",
    name: "Stability AI",
    category: "image",
    env: envFor("stability", "STABILITY_API_KEY"),
    billableToClients: true,
    check: { kind: "http", url: "https://api.stability.ai/v1/user/account", auth: "bearer" },
  },
  {
    key: "suno",
    name: "Suno",
    category: "music",
    env: "SUNO_API_KEY",
    billableToClients: false,
    check: { kind: "none", reason: "Suno has no public API yet (partner program only, July 2026)." },
    note: "Kept for when Suno opens its API. Not billable until then.",
  },
  {
    key: "lovable",
    name: "Lovable",
    category: "builder",
    env: "LOVABLE_API_KEY",
    billableToClients: false,
    check: { kind: "none", reason: "Lovable's API manages projects; it is a team tool, not a client AI service." },
    note: "Team tool for building sites. Not resold as credits.",
  },
  {
    key: "cursor",
    name: "Cursor",
    category: "builder",
    env: "CURSOR_API_KEY",
    billableToClients: false,
    check: { kind: "none", reason: "Cursor's API is for team agents and admin data, not a client AI service." },
    note: "Team coding tool. Not resold as credits.",
  },
];

export const AI_PROVIDER_KEYS = AI_PROVIDER_CATALOG.map((p) => p.key);

export function providerEntry(key: string): AiProviderEntry | null {
  return AI_PROVIDER_CATALOG.find((p) => p.key === key) ?? null;
}

export const CATEGORY_LABELS: Record<AiProviderCategory, string> = {
  text: "Text and chat",
  voice: "Voice",
  video: "Video",
  image: "Images",
  music: "Music",
  builder: "Team tools",
};

export const KEY_MIN_LENGTH = 16;
export const KEY_MAX_LENGTH = 512;

/** Trims a pasted key and rejects anything that cannot be an API key. */
export function normalizeApiKey(raw: unknown): { ok: true; key: string } | { ok: false; message: string } {
  if (typeof raw !== "string") return { ok: false, message: "Paste the API key." };
  const key = raw.trim();
  if (key.length < KEY_MIN_LENGTH || key.length > KEY_MAX_LENGTH) {
    return { ok: false, message: `An API key is ${KEY_MIN_LENGTH} to ${KEY_MAX_LENGTH} characters.` };
  }
  if (/\s/.test(key) || /[^\x21-\x7e]/.test(key)) {
    return { ok: false, message: "The key has spaces or invalid characters. Copy it again." };
  }
  return { ok: true, key };
}

/** The only part of a key ever shown again. */
export function keyHint(key: string): string {
  return key.slice(-4);
}

export interface CheckRequest {
  url: string;
  headers: Record<string, string>;
}

/** The read-only request that proves a key works, or null when none exists. */
export function buildCheckRequest(entry: AiProviderEntry, apiKey: string): CheckRequest | null {
  if (entry.check.kind !== "http") return null;
  const headers: Record<string, string> = { Accept: "application/json", ...(entry.check.extraHeaders ?? {}) };
  if (entry.check.auth === "bearer") headers.Authorization = `Bearer ${apiKey}`;
  else headers[entry.check.auth.header] = apiKey;
  return { url: entry.check.url, headers };
}

export type CheckOutcome = "verified" | "rejected" | "rate_limited" | "provider_error" | "network_error";

/** Maps the provider's HTTP status to an outcome. Bodies are never stored. */
export function outcomeForStatus(status: number): CheckOutcome {
  if (status >= 200 && status < 300) return "verified";
  if (status === 400 || status === 401 || status === 403) return "rejected";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

export const OUTCOME_MESSAGES: Record<CheckOutcome, string> = {
  verified: "The provider accepted the key.",
  rejected: "The provider refused the key. Check that it is correct and active.",
  rate_limited: "The provider is rate limiting this key. Try the test again in a minute.",
  provider_error: "The provider did not answer correctly. Try again later.",
  network_error: "The provider could not be reached from the server.",
};
