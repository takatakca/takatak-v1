// TAK bot relay: sends one prompt to one engine over HTTPS with a fixed
// endpoint. The API key goes only to the provider; raw provider errors are
// reduced to short codes and never reach the browser. Pure apart from the
// injected fetch, so it is testable without network access.

import type { TakbotEngine, TakbotMode } from "./catalog";

export type RelayResult =
  | { ok: true; text: string }
  | { ok: false; code: "timeout" | "network" | "rate_limited" | "auth" | "provider_error" | "empty" | "unsupported" };

export type RelayFetch = (input: string, init: RequestInit) => Promise<Response>;

export const RELAY_MAX_OUTPUT_TOKENS = 1200;
const TIMEOUT_MS = 45_000;

const SYSTEM: Record<TakbotMode, string> = {
  chat: "You are TAK bot, the AI assistant of GROUPE TAKATAK (Montréal). Answer clearly and briefly. Reply in the user's language (French or English).",
  write:
    "You are TAK bot, a senior marketing copywriter at GROUPE TAKATAK. Write ready-to-use, benefit-first copy. Reply in the user's language (French or English).",
  research:
    "You are TAK bot, a business research assistant at GROUPE TAKATAK. Give a structured answer with short sections and name your sources when you have them. Reply in the user's language (French or English).",
  image: "",
  voice: "",
  video: "",
};

function codeFor(status: number): Extract<RelayResult, { ok: false }>["code"] {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

export function modelFor(engine: TakbotEngine, env: Record<string, string | undefined> = process.env): string | undefined {
  const override = env[`TAKBOT_MODEL_${engine.key.toUpperCase()}`]?.trim();
  return override || engine.defaultModel;
}

function buildRequest(engine: TakbotEngine, mode: TakbotMode, apiKey: string, model: string, prompt: string): { url: string; init: RequestInit } | null {
  const system = SYSTEM[mode];
  if (engine.relay === "openai_compat" && engine.endpoint) {
    return {
      url: engine.endpoint,
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: RELAY_MAX_OUTPUT_TOKENS,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      },
    };
  }
  if (engine.relay === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: RELAY_MAX_OUTPUT_TOKENS, system, messages: [{ role: "user", content: prompt }] }),
      },
    };
  }
  if (engine.relay === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init: {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: RELAY_MAX_OUTPUT_TOKENS },
        }),
      },
    };
  }
  return null;
}

/** Extracts the answer text from each provider's response shape. */
export function readRelayText(engine: TakbotEngine, body: unknown): string {
  if (engine.relay === "anthropic") {
    const b = body as { content?: { type?: string; text?: unknown }[] };
    return (b?.content ?? [])
      .filter((p) => p?.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("")
      .trim();
  }
  if (engine.relay === "gemini") {
    const b = body as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
    return (b?.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();
  }
  const b = body as { choices?: { message?: { content?: unknown } }[] };
  const content = b?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

export async function relayPrompt(
  input: { engine: TakbotEngine; mode: TakbotMode; apiKey: string; prompt: string },
  fetchImpl: RelayFetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<RelayResult> {
  const model = modelFor(input.engine, env);
  const request = model ? buildRequest(input.engine, input.mode, input.apiKey, model, input.prompt) : null;
  if (!request) return { ok: false, code: "unsupported" };
  let response: Response;
  try {
    response = await fetchImpl(request.url, { ...request.init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" });
  } catch (error) {
    return { ok: false, code: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" };
  }
  if (!response.ok) return { ok: false, code: codeFor(response.status) };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, code: "provider_error" };
  }
  const text = readRelayText(input.engine, body);
  return text ? { ok: true, text } : { ok: false, code: "empty" };
}
