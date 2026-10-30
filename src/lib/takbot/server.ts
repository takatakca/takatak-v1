import "server-only";

// TAK bot server side: which engines are connected (a key is saved or set in
// the environment), and one metered run: debit credits, relay, refund on failure.

import { debitCredits, getCreditSnapshot, refundDebit } from "@/lib/ai-credits/ledger";
import { providerEntry } from "@/lib/ai-providers/catalog";
import { resolveProviderKey } from "@/lib/ai-providers/store";
import { aiCreditsCheckoutEnabled } from "@/lib/billing/ai-credits/stripe";

import { TAKBOT_ENGINES, routeTakbotRequest } from "./catalog";
import { relayPrompt, type RelayResult } from "./relay";

async function keyFor(engineKey: string): Promise<string | null> {
  try {
    return await resolveProviderKey(engineKey);
  } catch {
    // No database (or no saved key table): fall back to the environment variable.
    const entry = providerEntry(engineKey);
    return entry ? process.env[entry.env]?.trim() || null : null;
  }
}

/** Engines with a usable key. Booleans only: keys never leave this module. */
export async function connectedEngines(): Promise<Set<string>> {
  const checks = await Promise.all(TAKBOT_ENGINES.map(async (e) => [e.key, Boolean(await keyFor(e.key))] as const));
  return new Set(checks.filter(([, ok]) => ok).map(([key]) => key));
}

export async function creditBalance(clientId: string): Promise<number | null> {
  try {
    return (await getCreditSnapshot(clientId)).balance;
  } catch {
    return null;
  }
}

export function takbotCheckoutEnabled(): boolean {
  return aiCreditsCheckoutEnabled();
}

export type TakbotRunResult =
  | { ok: true; text: string; engine: string; engineName: string; auto: boolean; credits: number; balance: number }
  | { ok: false; status: number; code: string; balance?: number };

const RELAY_STATUS: Record<Extract<RelayResult, { ok: false }>["code"], number> = {
  timeout: 504,
  network: 502,
  rate_limited: 429,
  auth: 502,
  provider_error: 502,
  empty: 502,
  unsupported: 400,
};

export async function runTakbot(input: {
  clientId: string;
  mode: string;
  engine: string;
  prompt: string;
  requestId: string;
}): Promise<TakbotRunResult> {
  const decision = routeTakbotRequest({ mode: input.mode, engine: input.engine, connected: await connectedEngines() });
  if (!decision.ok) return { ok: false, status: decision.code === "no_engine_connected" ? 503 : 400, code: decision.code };

  const apiKey = await keyFor(decision.engine.key);
  if (!apiKey) return { ok: false, status: 503, code: "no_engine_connected" };

  const idempotencyKey = `takbot:${input.requestId}`;
  const debit = await debitCredits({ clientId: input.clientId, actionKey: decision.mode.actionKey, idempotencyKey });
  if (!debit.ok) {
    const status = debit.code === "insufficient_credits" ? 402 : debit.code === "idempotency_conflict" ? 409 : 400;
    return { ok: false, status, code: debit.code, balance: debit.balance };
  }
  if (debit.replayed) return { ok: false, status: 409, code: "already_processed", balance: debit.balance };

  const relayed = await relayPrompt({ engine: decision.engine, mode: decision.mode.key, apiKey, prompt: input.prompt });
  if (!relayed.ok) {
    const refund = await refundDebit({ clientId: input.clientId, debitIdempotencyKey: idempotencyKey, note: `TAK bot ${relayed.code}` });
    return { ok: false, status: RELAY_STATUS[relayed.code], code: relayed.code, balance: refund.ok ? refund.balance : debit.balance };
  }
  return {
    ok: true,
    text: relayed.text,
    engine: decision.engine.key,
    engineName: decision.engine.name,
    auto: decision.auto,
    credits: decision.credits,
    balance: debit.balance,
  };
}
