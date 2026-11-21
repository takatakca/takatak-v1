import "server-only";

// Which engine AI Studio uses right now. A provider key set for AI Studio
// (AI_STUDIO_GENERATION_ENABLED) wins; otherwise the TAK-TAK engines already
// connected write the drafts, billed in AI credits like TAK-TAK itself. Keys
// never leave the server: pages only see a label and a price.
import { routeTakbotRequest } from "@/lib/takbot/catalog";
import { connectedEngines, creditBalance, runTakbot } from "@/lib/takbot/server";

import { studioDailyLimit, type AiStudioConfig } from "./config";
import { loadAiStudioConfig } from "./load-config";
import type { StudioCallResult } from "./service";
import { studioFailureFromTakbot, takbotStudioPrompt } from "./takbot-failure";

export type StudioEngine =
  | { kind: "direct"; config: Extract<AiStudioConfig, { enabled: true }>; dailyLimit: number }
  | { kind: "takbot"; credits: number; dailyLimit: number }
  | { kind: "off"; reason: Extract<AiStudioConfig, { enabled: false }>["reason"] };

/** The TAK-TAK mode used for AI Studio drafts (the "write" price in credits). */
export const STUDIO_TAKBOT_MODE = "write";

export async function resolveStudioEngine(): Promise<StudioEngine> {
  const config = await loadAiStudioConfig();
  if (config.enabled) return { kind: "direct", config, dailyLimit: config.dailyLimit };
  const connected = await connectedEngines().catch(() => new Set<string>());
  const route = routeTakbotRequest({ mode: STUDIO_TAKBOT_MODE, engine: "auto", connected });
  if (route.ok) return { kind: "takbot", credits: route.credits, dailyLimit: studioDailyLimit() };
  return { kind: "off", reason: config.reason };
}

/** The workspace's credit balance, or null when it cannot be read. */
export async function studioCreditBalance(clientId: string): Promise<number | null> {
  return creditBalance(clientId);
}

/** Writes one draft on the TAK-TAK engines; the job id makes the debit idempotent. */
export async function takbotStudioCall(
  clientId: string,
  prompt: { system: string; user: string },
  jobId: string,
): Promise<StudioCallResult> {
  const result = await runTakbot({
    clientId,
    mode: STUDIO_TAKBOT_MODE,
    engine: "auto",
    prompt: takbotStudioPrompt(prompt),
    requestId: `ai-studio:${jobId}`,
    persist: false,
  });
  if (!result.ok) return { ok: false, code: studioFailureFromTakbot(result.code) };
  return {
    ok: true,
    text: result.text,
    inputTokens: null,
    outputTokens: null,
    meta: { engine: result.engine, engineName: result.engineName, credits: result.credits, balance: result.balance, trial: result.trial },
  };
}
