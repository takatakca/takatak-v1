import "server-only";

// TAK bot server side: which engines are connected (a key is saved or set in
// the environment), and one metered run: debit credits, relay, refund on failure.

import { debitCredits, getCreditSnapshot, refundDebit } from "@/lib/ai-credits/ledger";
import { providerEntry } from "@/lib/ai-providers/catalog";
import { resolveProviderKey } from "@/lib/ai-providers/store";
import { aiCreditsCheckoutEnabled } from "@/lib/billing/ai-credits/stripe";
import { getPrisma } from "@/lib/db/prisma";

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

const CONNECTED_TTL_MS = 60_000;
let connectedCache: { at: number; keys: Set<string> } | null = null;

/**
 * Engines with a key saved (one query on provider names, nothing decrypted)
 * or set in the environment. Cached a minute: the public catalog calls it on
 * every page load. A run still resolves its own key and fails cleanly without one.
 */
export async function connectedEngines(now = Date.now()): Promise<Set<string>> {
  if (connectedCache && now - connectedCache.at < CONNECTED_TTL_MS) return connectedCache.keys;
  let saved = new Set<string>();
  try {
    const rows = (await getPrisma()?.aiProviderCredential.findMany({ select: { provider: true } })) ?? [];
    saved = new Set(rows.map((r) => r.provider));
  } catch {
    /* no database: environment keys only */
  }
  const keys = new Set(
    TAKBOT_ENGINES.filter((e) => {
      const entry = providerEntry(e.key);
      return saved.has(e.key) || Boolean(entry && process.env[entry.env]?.trim());
    }).map((e) => e.key),
  );
  connectedCache = { at: now, keys };
  return keys;
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
