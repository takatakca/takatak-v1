// TAK-TAK trial: a few free credits for new accounts, run on an economy
// engine. Premium engines unlock once the workspace has bought (or been
// granted) real credits. Pure module: configuration and routing only.

export const TRIAL_DEFAULT_CREDITS = 50;
/** Economy engines, cheapest first, tried when TAKBOT_TRIAL_ENGINE is not set. */
export const TRIAL_ECONOMY_ORDER = ["groq", "ollama", "gemini", "deepseek", "openai"] as const;
/** Ledger key prefix of the one-time trial grant (the ledger adds "grant:"). */
export const TRIAL_GRANT_PREFIX = "takbot-trial:";

export interface TrialConfig {
  enabled: boolean;
  credits: number;
  /** Explicit engine, or null to pick the first connected economy engine. */
  engineKey: string | null;
  /** Explicit model for the trial engine, or null for the engine default. */
  model: string | null;
}

export function readTrialConfig(env: Record<string, string | undefined> = process.env): TrialConfig {
  const raw = env.TAKBOT_TRIAL_CREDITS?.trim();
  const parsed = raw === undefined || raw === "" ? TRIAL_DEFAULT_CREDITS : Number(raw);
  const credits = Number.isInteger(parsed) && parsed >= 0 && parsed <= 1000 ? parsed : TRIAL_DEFAULT_CREDITS;
  const engineKey = env.TAKBOT_TRIAL_ENGINE?.trim().toLowerCase() || null;
  const model = env.TAKBOT_TRIAL_MODEL?.trim() || null;
  return { enabled: credits > 0 && env.TAKBOT_TRIAL_ENABLED?.trim() !== "false", credits, engineKey, model };
}

/** The engine trial requests run on, among the connected ones (null = none available). */
export function trialEngineKey(config: TrialConfig, connected: ReadonlySet<string>): string | null {
  if (!config.enabled) return null;
  if (config.engineKey) return connected.has(config.engineKey) ? config.engineKey : null;
  return TRIAL_ECONOMY_ORDER.find((k) => connected.has(k)) ?? null;
}

/** The ledger key of a workspace's trial grant (one per workspace, ever). */
export function trialGrantKey(clientId: string): string {
  return `${TRIAL_GRANT_PREFIX}${clientId}`;
}

export type TrialRoute =
  | { kind: "premium" }
  | { kind: "trial"; engineKey: string; model: string | null }
  | { kind: "unavailable" };

/**
 * Which engines a run may use. A workspace that has bought or been granted
 * real credits uses the normal routing (premium engines included). Otherwise
 * it runs on the trial engine, whatever engine was picked.
 */
export function routeForWorkspace(input: { premiumUnlocked: boolean; config: TrialConfig; connected: ReadonlySet<string> }): TrialRoute {
  // Trial switched off: everyone uses the normal routing (credits only come from purchases or grants).
  if (input.premiumUnlocked || !input.config.enabled) return { kind: "premium" };
  const engineKey = trialEngineKey(input.config, input.connected);
  return engineKey ? { kind: "trial", engineKey, model: input.config.model } : { kind: "unavailable" };
}
