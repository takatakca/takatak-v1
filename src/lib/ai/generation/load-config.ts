import "server-only";

// AI Studio configuration with the provider key resolved server side.
// The key saved in Admin › AI provider keys (#155) wins; the server variable
// (OPENAI_API_KEY / ANTHROPIC_API_KEY) is the fallback, as before. The key is
// only ever used by the server; pages see the provider and model only.

import { resolveProviderKey } from "@/lib/ai-providers/store";

import { readAiStudioConfig, type AiStudioConfig } from "./config";

const ENV_KEY = { openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" } as const;

export async function loadAiStudioConfig(
  env: Record<string, string | undefined> = process.env,
  resolveKey: (provider: string) => Promise<string | null> = resolveProviderKey,
): Promise<AiStudioConfig> {
  const base = readAiStudioConfig(env);
  if (base.enabled === false && base.reason !== "missing_key") return base;

  const provider = (env.AI_STUDIO_PROVIDER?.trim() || "openai") as keyof typeof ENV_KEY;
  let saved: string | null = null;
  try {
    saved = await resolveKey(provider);
  } catch {
    // Key store unavailable (no database or encryption key): keep the server variable.
    return base;
  }
  if (!saved) return base;
  return readAiStudioConfig({ ...env, [ENV_KEY[provider]]: saved });
}
