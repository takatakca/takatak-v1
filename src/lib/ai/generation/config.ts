// AI Studio live generation — server configuration. Off unless explicitly
// enabled with a provider key and model. Keys never leave the server.

export type AiStudioProvider = "openai" | "anthropic";

export type AiStudioConfig =
  | { enabled: false; reason: "disabled" | "missing_key" | "missing_model" | "invalid_provider" }
  | { enabled: true; provider: AiStudioProvider; apiKey: string; model: string; dailyLimit: number };

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";
export const DEFAULT_DAILY_LIMIT = 50;

const MODEL_RE = /^[A-Za-z0-9._:-]{2,100}$/;

export function readAiStudioConfig(env: Record<string, string | undefined> = process.env): AiStudioConfig {
  if (env.AI_STUDIO_GENERATION_ENABLED?.trim() !== "true") return { enabled: false, reason: "disabled" };

  const provider = (env.AI_STUDIO_PROVIDER?.trim() || "openai") as AiStudioProvider;
  if (provider !== "openai" && provider !== "anthropic") return { enabled: false, reason: "invalid_provider" };

  const apiKey = (provider === "openai" ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY)?.trim() ?? "";
  if (apiKey.length < 20) return { enabled: false, reason: "missing_key" };

  // OpenAI model names change often: the model must be chosen explicitly.
  const model =
    provider === "openai"
      ? env.AI_STUDIO_OPENAI_MODEL?.trim() ?? ""
      : env.AI_STUDIO_ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
  if (!MODEL_RE.test(model)) return { enabled: false, reason: "missing_model" };

  const limit = Number(env.AI_STUDIO_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
  const dailyLimit = Number.isInteger(limit) && limit >= 1 && limit <= 1000 ? limit : DEFAULT_DAILY_LIMIT;

  return { enabled: true, provider, apiKey, model, dailyLimit };
}

export const DISABLED_REASON_LABELS: Record<Extract<AiStudioConfig, { enabled: false }>["reason"], string> = {
  disabled: "Live generation is off (AI_STUDIO_GENERATION_ENABLED is not true).",
  invalid_provider: "AI_STUDIO_PROVIDER must be openai or anthropic.",
  missing_key: "The provider API key is missing (OPENAI_API_KEY or ANTHROPIC_API_KEY).",
  missing_model: "No model is set (AI_STUDIO_OPENAI_MODEL is required for OpenAI).",
};
