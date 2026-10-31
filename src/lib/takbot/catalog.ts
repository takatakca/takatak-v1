// TAK bot — the master bot that relays a request to the right AI engine.
// Pure data and routing (no I/O), shared by the public /takbot page and the
// /api/takbot routes, so what the page promises is exactly what the server runs.
//
// Engines come from the existing provider catalogs (src/lib/growth/ai-engine.ts,
// src/lib/ai-providers/catalog.ts). Credit costs come from AI_CREDIT_ACTIONS and
// packs from AI_CREDIT_PACKS: this file never invents a price.

import { AI_CREDIT_ACTIONS, AI_CREDIT_PACKS, AI_PROVIDERS } from "@/lib/growth/ai-engine";
import { AI_PROVIDER_CATALOG } from "@/lib/ai-providers/catalog";

export type TakbotMode = "chat" | "write" | "research" | "image" | "voice" | "video";

/** How the server talks to an engine. Only `openai_compat`, `anthropic` and
 *  `gemini` engines answer from the TAK bot page today; the others are routed
 *  through the AI Studio jobs and show as "studio" on the page. */
export type RelayKind = "openai_compat" | "anthropic" | "gemini" | "studio";

export interface TakbotEngine {
  key: string;
  name: string;
  modes: readonly TakbotMode[];
  bestFor: string;
  relay: RelayKind;
  /** Model sent by the relay (text engines only). Overridable per engine with TAKBOT_MODEL_<KEY>. */
  defaultModel?: string;
  /** OpenAI-compatible chat completions endpoint. */
  endpoint?: string;
}

export interface TakbotModeDef {
  key: TakbotMode;
  /** Credit action debited for one request in this mode (AI_CREDIT_ACTIONS). */
  actionKey: string;
  /** Engine TAK bot picks when the visitor leaves "Auto" on, in order of preference. */
  autoOrder: readonly string[];
  /** True when the TAK bot page can answer this mode inline today. */
  inline: boolean;
}

export const TAKBOT_MODES: readonly TakbotModeDef[] = [
  { key: "chat", actionKey: "chat_reply", autoOrder: ["anthropic", "openai", "gemini", "mistral", "groq", "deepseek", "xai"], inline: true },
  { key: "write", actionKey: "ad_copy_set", autoOrder: ["anthropic", "openai", "mistral", "gemini", "deepseek"], inline: true },
  { key: "research", actionKey: "seo_audit_summary", autoOrder: ["perplexity", "gemini", "anthropic", "openai"], inline: true },
  { key: "image", actionKey: "image", autoOrder: ["openai", "stability", "gemini"], inline: false },
  { key: "voice", actionKey: "voice_over", autoOrder: ["elevenlabs", "openai", "heygen"], inline: false },
  { key: "video", actionKey: "short_video", autoOrder: ["runway", "heygen", "gemini"], inline: false },
];

const OPENAI_COMPAT: Record<string, { endpoint: string; model: string }> = {
  openai: { endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-5-mini" },
  xai: { endpoint: "https://api.x.ai/v1/chat/completions", model: "grok-4" },
  mistral: { endpoint: "https://api.mistral.ai/v1/chat/completions", model: "mistral-large-latest" },
  deepseek: { endpoint: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
  groq: { endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
  perplexity: { endpoint: "https://api.perplexity.ai/chat/completions", model: "sonar" },
};

const CAPABILITY_MODES: Record<string, TakbotMode[]> = {
  text: ["chat", "write", "research"],
  code: ["chat"],
  search: ["research"],
  image: ["image"],
  voice: ["voice"],
  video: ["video"],
};

function relayFor(key: string): RelayKind {
  if (key in OPENAI_COMPAT) return "openai_compat";
  if (key === "anthropic") return "anthropic";
  if (key === "gemini") return "gemini";
  return "studio";
}

/** Every engine TAK bot can relay to, built from the provider catalogs (client-billable only). */
export const TAKBOT_ENGINES: readonly TakbotEngine[] = AI_PROVIDERS.filter((p) =>
  AI_PROVIDER_CATALOG.some((c) => c.key === p.key && c.billableToClients),
).map((p) => {
  const modes = Array.from(new Set(p.capabilities.flatMap((c) => CAPABILITY_MODES[c] ?? [])));
  const relay = relayFor(p.key);
  const compat = OPENAI_COMPAT[p.key];
  return {
    key: p.key,
    name: p.name,
    modes,
    bestFor: p.bestFor,
    relay,
    defaultModel: compat?.model ?? (p.key === "anthropic" ? "claude-sonnet-5-5" : p.key === "gemini" ? "gemini-2.5-flash" : undefined),
    endpoint: compat?.endpoint,
  };
});

export function takbotMode(key: string): TakbotModeDef | null {
  return TAKBOT_MODES.find((m) => m.key === key) ?? null;
}

export function takbotEngine(key: string): TakbotEngine | null {
  return TAKBOT_ENGINES.find((e) => e.key === key) ?? null;
}

export function creditsFor(mode: TakbotModeDef): number {
  return AI_CREDIT_ACTIONS.find((a) => a.key === mode.actionKey)?.credits ?? 0;
}

export type RouteDecision =
  | { ok: true; mode: TakbotModeDef; engine: TakbotEngine; auto: boolean; credits: number }
  | { ok: false; code: "unknown_mode" | "unknown_engine" | "engine_mode_mismatch" | "no_engine_connected" | "mode_not_inline" };

/**
 * The master bot's routing rule. "auto" picks the first connected engine in the
 * mode's preference order; a named engine must support the mode and be connected.
 */
export function routeTakbotRequest(input: {
  mode: string;
  engine: string;
  connected: ReadonlySet<string>;
}): RouteDecision {
  const mode = takbotMode(input.mode);
  if (!mode) return { ok: false, code: "unknown_mode" };
  if (!mode.inline) return { ok: false, code: "mode_not_inline" };
  const credits = creditsFor(mode);
  if (input.engine === "auto") {
    for (const key of mode.autoOrder) {
      const engine = takbotEngine(key);
      if (engine && engine.relay !== "studio" && engine.modes.includes(mode.key) && input.connected.has(key)) {
        return { ok: true, mode, engine, auto: true, credits };
      }
    }
    return { ok: false, code: "no_engine_connected" };
  }
  const engine = takbotEngine(input.engine);
  if (!engine) return { ok: false, code: "unknown_engine" };
  if (!engine.modes.includes(mode.key) || engine.relay === "studio") return { ok: false, code: "engine_mode_mismatch" };
  if (!input.connected.has(engine.key)) return { ok: false, code: "no_engine_connected" };
  return { ok: true, mode, engine, auto: false, credits };
}

export const TAKBOT_PACKS = AI_CREDIT_PACKS;

export const TAKBOT_ACTIONS = AI_CREDIT_ACTIONS;

export const MAX_PROMPT_CHARS = 4000;
