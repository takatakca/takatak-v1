import "server-only";

// TAK-TAK server side: which engines are connected (a key is saved or set in
// the environment), and one metered run: debit credits, relay, refund on failure.

import { debitCredits, getCreditSnapshot, grantCredits, refundDebit } from "@/lib/ai-credits/ledger";
import { providerEntry } from "@/lib/ai-providers/catalog";
import { resolveProviderKey } from "@/lib/ai-providers/store";
import { aiCreditsCheckoutEnabled } from "@/lib/billing/ai-credits/stripe";
import { getPrisma } from "@/lib/db/prisma";

import { TAKBOT_ENGINES, routeTakbotRequest, takbotEngine } from "./catalog";
import { relayPrompt, type RelayResult, type RelayUsage } from "./relay";
import { TRIAL_GRANT_PREFIX, readTrialConfig, routeForWorkspace, trialEngineKey, trialGrantKey } from "./trial";

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
  | { ok: true; text: string; engine: string; engineName: string; auto: boolean; credits: number; balance: number; trial: boolean; savedId: string | null }
  | { ok: false; status: number; code: string; balance?: number };

/** True once the workspace has bought credits or been granted credits other than the trial. */
export async function premiumUnlocked(clientId: string): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;
  try {
    const entry = await prisma.aiCreditEntry.findFirst({
      where: {
        clientId,
        reason: { in: ["purchase", "grant"] },
        NOT: { idempotencyKey: { startsWith: `grant:${TRIAL_GRANT_PREFIX}` } },
      },
      select: { id: true },
    });
    return Boolean(entry);
  } catch {
    return false;
  }
}

export interface TrialStatus {
  enabled: boolean;
  credits: number;
  /** Engine the trial runs on, or null when none is connected yet. */
  engineName: string | null;
  claimed: boolean;
  premium: boolean;
}

export async function trialStatus(clientId: string | null): Promise<TrialStatus> {
  const config = readTrialConfig();
  const engineKey = trialEngineKey(config, await connectedEngines());
  const base: TrialStatus = {
    enabled: config.enabled && Boolean(engineKey),
    credits: config.credits,
    engineName: engineKey ? takbotEngine(engineKey)?.name ?? null : null,
    claimed: false,
    premium: false,
  };
  if (!clientId) return base;
  const prisma = getPrisma();
  if (!prisma) return base;
  try {
    const [grant, premium] = await Promise.all([
      prisma.aiCreditEntry.findUnique({ where: { idempotencyKey: `grant:${trialGrantKey(clientId)}` }, select: { id: true } }),
      premiumUnlocked(clientId),
    ]);
    return { ...base, claimed: Boolean(grant), premium };
  } catch {
    return base;
  }
}

/** Gives a workspace its trial credits, once ever (the ledger key makes a retry a no-op). */
export async function claimTrial(clientId: string): Promise<{ ok: true; balance: number; granted: boolean } | { ok: false; code: string }> {
  const status = await trialStatus(clientId);
  if (!status.enabled) return { ok: false, code: "trial_unavailable" };
  const result = await grantCredits({
    clientId,
    credits: status.credits,
    reason: "grant",
    idempotencyKey: trialGrantKey(clientId),
    note: "TAK-TAK trial (economy engine)",
  });
  if (!result.ok) return { ok: false, code: result.code };
  return { ok: true, balance: result.balance, granted: !result.replayed };
}

const SAVED_KIND = { chat: "creative_brief", write: "post_long", research: "report_summary" } as const;

/** Keeps the answer in the client's file (AI Studio → saved outputs). Never fails the run. */
async function saveOutput(input: { clientId: string; mode: string; prompt: string; text: string; engine: string; trial: boolean; requestId: string; model: string; usage: RelayUsage; retailCredits: number }): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    const kind = SAVED_KIND[input.mode as keyof typeof SAVED_KIND] ?? "creative_brief";
    const row = await prisma.savedAiOutput.create({
      data: {
        clientId: input.clientId,
        kind,
        title: input.prompt.replace(/\s+/g, " ").slice(0, 120),
        content: input.text.slice(0, 20_000),
        origin: "ai_generated",
        status: "saved",
        metadata: { source: "takbot", mode: input.mode, engine: input.engine, trial: input.trial, requestId: input.requestId, model: input.model, modelEvidence: "requested",
          usage: { ...input.usage }, retailCredits: input.retailCredits, providerCost: null, providerCostStatus: "unreconciled" },
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    console.error("[takbot] could not save the output");
    return null;
  }
}

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
  const connected = await connectedEngines();
  const route = routeForWorkspace({ premiumUnlocked: await premiumUnlocked(input.clientId), config: readTrialConfig(), connected });
  if (route.kind === "unavailable") return { ok: false, status: 503, code: "no_engine_connected" };
  const trial = route.kind === "trial";
  const decision = routeTakbotRequest({ mode: input.mode, engine: trial ? route.engineKey : input.engine, connected });
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

  const relayed = await relayPrompt({
    engine: decision.engine,
    mode: decision.mode.key,
    apiKey,
    prompt: input.prompt,
    model: trial ? route.model : null,
  });
  if (!relayed.ok) {
    const refund = await refundDebit({ clientId: input.clientId, debitIdempotencyKey: idempotencyKey, note: `TAK-TAK ${relayed.code}` });
    return { ok: false, status: RELAY_STATUS[relayed.code], code: relayed.code, balance: refund.ok ? refund.balance : debit.balance };
  }
  const savedId = await saveOutput({ clientId: input.clientId, mode: decision.mode.key, prompt: input.prompt, text: relayed.text, engine: decision.engine.key, trial, requestId: input.requestId, model: relayed.model, usage: relayed.usage, retailCredits: decision.credits });
  return {
    ok: true,
    text: relayed.text,
    engine: decision.engine.key,
    engineName: decision.engine.name,
    auto: decision.auto,
    credits: decision.credits,
    balance: debit.balance,
    trial,
    savedId,
  };
}
