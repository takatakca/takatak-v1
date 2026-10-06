// Calls the configured AI provider over HTTPS with a fixed endpoint. The API
// key is sent only to the provider. Errors are reduced to short codes; raw
// provider messages are never returned to the browser.

import type { AiStudioProvider } from "./config";

export type GenerationResult =
  | { ok: true; text: string; inputTokens: number | null; outputTokens: number | null }
  | { ok: false; code: "timeout" | "network" | "rate_limited" | "auth" | "provider_error" | "empty" };

const ENDPOINTS: Record<AiStudioProvider, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
};

export const MAX_OUTPUT_TOKENS = 900;
const TIMEOUT_MS = 45_000;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

function statusCode(status: number): Extract<GenerationResult, { ok: false }>["code"] {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

export function readOpenAiText(body: unknown): { text: string; inputTokens: number | null; outputTokens: number | null } {
  const b = body as { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const content = b?.choices?.[0]?.message?.content;
  return {
    text: typeof content === "string" ? content.trim() : "",
    inputTokens: typeof b?.usage?.prompt_tokens === "number" ? b.usage.prompt_tokens : null,
    outputTokens: typeof b?.usage?.completion_tokens === "number" ? b.usage.completion_tokens : null,
  };
}

export function readAnthropicText(body: unknown): { text: string; inputTokens: number | null; outputTokens: number | null } {
  const b = body as { content?: { type?: string; text?: unknown }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const text = (b?.content ?? [])
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim();
  return {
    text,
    inputTokens: typeof b?.usage?.input_tokens === "number" ? b.usage.input_tokens : null,
    outputTokens: typeof b?.usage?.output_tokens === "number" ? b.usage.output_tokens : null,
  };
}

export async function callProvider(
  config: { provider: AiStudioProvider; apiKey: string; model: string },
  prompt: { system: string; user: string },
  fetchImpl: FetchLike = fetch,
): Promise<GenerationResult> {
  const openai = config.provider === "openai";
  const init: RequestInit = {
    method: "POST",
    headers: openai
      ? { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" }
      : { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify(
      openai
        ? {
            model: config.model,
            max_completion_tokens: MAX_OUTPUT_TOKENS,
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
          }
        : {
            model: config.model,
            max_tokens: MAX_OUTPUT_TOKENS,
            system: prompt.system,
            messages: [{ role: "user", content: prompt.user }],
          },
    ),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "error",
  };

  let response: Response;
  try {
    response = await fetchImpl(ENDPOINTS[config.provider], init);
  } catch (error) {
    return { ok: false, code: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" };
  }
  if (!response.ok) return { ok: false, code: statusCode(response.status) };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, code: "provider_error" };
  }
  const parsed = openai ? readOpenAiText(body) : readAnthropicText(body);
  if (!parsed.text) return { ok: false, code: "empty" };
  return { ok: true, text: parsed.text.slice(0, 8000), inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens };
}
