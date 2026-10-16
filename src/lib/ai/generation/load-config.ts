import "server-only";

// AI Studio live generation: the configuration with the provider key taken
// from Admin › AI provider keys when one is saved, else from the environment.
// The database is only read when generation is switched on and the provider is
// valid, and a storage failure falls back to the environment key.

import { resolveProviderKey } from "@/lib/ai-providers/store";

import { readAiStudioConfig, type AiStudioConfig } from "./config";

export async function loadAiStudioConfig(env: Record<string, string | undefined> = process.env): Promise<AiStudioConfig> {
  const base = readAiStudioConfig(env);
  if (!base.enabled && base.reason !== "missing_key") return base;

  const provider = base.enabled ? base.provider : env.AI_STUDIO_PROVIDER?.trim() || "openai";
  if (provider !== "openai" && provider !== "anthropic") return base;

  let saved: string | null = null;
  try {
    saved = await resolveProviderKey(provider);
  } catch {
    console.error("[ai-studio] saved provider key unavailable; using the environment key");
  }
  return readAiStudioConfig(env, { [provider]: saved });
}
