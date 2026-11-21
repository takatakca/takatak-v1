import "server-only";

// One read-only snapshot of every AI system in TAKATAK, for the platform
// owner's AI Control Center (/dashboard/admin/ai). It reuses the sources the
// other AI screens already use and never decrypts or returns a key: only
// states, counts and the names of the settings to change.
import { AI_PROVIDER_CATALOG, type AiProviderCategory } from "@/lib/ai-providers/catalog";
import { listProviderKeys, providerKeysStorageReady, type ProviderKeyState } from "@/lib/ai-providers/store";
import { readAiStudioConfig } from "@/lib/ai/generation/config";
import { aiCreditsCheckoutEnabled } from "@/lib/billing/ai-credits/stripe";
import { getPrisma } from "@/lib/db/prisma";
import { AI_AGENTS, AI_GATEWAY_ENV } from "@/lib/growth/ai-engine";
import { TAKBOT_ENGINES } from "@/lib/takbot/catalog";
import { connectedEngines, trialStatus } from "@/lib/takbot/server";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AiControlEngine {
  key: string;
  name: string;
  category: AiProviderCategory;
  /** Usable by TAK-TAK (the AI on the homepage and in the studio). */
  inTakbot: boolean;
  /** A key is available to the server (saved in the dashboard or set as a server variable). */
  connected: boolean;
  keyState: ProviderKeyState;
  keyHint: string | null;
  lastCheckedAt: string | null;
  env: string;
  billableToClients: boolean;
}

export interface AiControlAgent {
  key: string;
  name: string;
  mission: string;
  alwaysRequiresApproval: boolean;
  enabledWorkspaces: number;
  runs30d: number;
  completed30d: number;
  failed30d: number;
  awaitingApproval: number;
  lastRunAt: string | null;
}

export interface AiControlRun {
  id: string;
  agentKey: string;
  status: string;
  trigger: string;
  workspace: string;
  creditsDebited: number;
  createdAt: string;
  error: string | null;
}

export interface AiControlSwitch {
  key: "studio" | "trial" | "checkout" | "gateway" | "key_storage";
  on: boolean;
  label: string;
  detail: string;
  /** What to set (server variables) to change it; names only, never values. */
  settings: string[];
}

export interface AiControlSnapshot {
  generatedAt: string;
  databaseAvailable: boolean;
  engines: AiControlEngine[];
  switches: AiControlSwitch[];
  credits: {
    accounts: number;
    totalBalance: number;
    spent30d: number;
    granted30d: number;
    purchased30d: number;
    debits30d: number;
  } | null;
  agents: AiControlAgent[];
  recentRuns: AiControlRun[];
  providerEvents30d: number | null;
}

const STUDIO_REASON: Record<string, string> = {
  disabled: "AI Studio live generation is off.",
  missing_key: "AI Studio generation is on, but its provider has no key.",
  missing_model: "AI Studio generation is on, but no valid model is set.",
  invalid_provider: "AI Studio generation names an unknown provider.",
};

function studioSwitch(): AiControlSwitch {
  const config = readAiStudioConfig();
  const settings = ["AI_STUDIO_GENERATION_ENABLED", "AI_STUDIO_PROVIDER", "AI_STUDIO_OPENAI_MODEL / AI_STUDIO_ANTHROPIC_MODEL", "AI_STUDIO_DAILY_LIMIT"];
  if (config.enabled) {
    return {
      key: "studio",
      on: true,
      label: "AI Studio content generator",
      detail: `On: ${config.provider} · ${config.model} · up to ${config.dailyLimit} drafts per workspace per day.`,
      settings,
    };
  }
  return { key: "studio", on: false, label: "AI Studio content generator", detail: STUDIO_REASON[config.reason] ?? "Off.", settings };
}

/** Builds the snapshot. Each part degrades on its own: one failing source never hides the others. */
export async function getAiControlSnapshot(now = Date.now()): Promise<AiControlSnapshot> {
  const prisma = getPrisma();
  const since = new Date(now - 30 * DAY_MS);

  // Engines: the provider catalog with each key's state, plus whether TAK-TAK can use it.
  const takbotKeys = new Set(TAKBOT_ENGINES.map((engine) => engine.key));
  const connected = await connectedEngines(now).catch(() => new Set<string>());
  let keyViews: Awaited<ReturnType<typeof listProviderKeys>> | null = null;
  try {
    keyViews = await listProviderKeys();
  } catch {
    keyViews = null;
  }
  const viewByKey = new Map((keyViews ?? []).map((view) => [view.key, view]));
  const engines: AiControlEngine[] = AI_PROVIDER_CATALOG.map((entry) => {
    const view = viewByKey.get(entry.key);
    const envSet = Boolean(process.env[entry.env]?.trim());
    const keyState: ProviderKeyState = view?.state ?? (envSet ? "env_only" : "not_configured");
    return {
      key: entry.key,
      name: entry.name,
      category: entry.category,
      inTakbot: takbotKeys.has(entry.key),
      connected: connected.has(entry.key) || keyState !== "not_configured",
      keyState,
      keyHint: view?.keyHint ?? null,
      lastCheckedAt: view?.lastCheckedAt ?? null,
      env: entry.env,
      billableToClients: entry.billableToClients,
    };
  });

  // Switches.
  const trial = await trialStatus(null).catch(() => null);
  const gatewayMissing = AI_GATEWAY_ENV.filter((name) => !process.env[name]?.trim());
  const switches: AiControlSwitch[] = [
    studioSwitch(),
    {
      key: "trial",
      on: Boolean(trial?.enabled),
      label: "TAK-TAK free trial",
      detail: trial?.enabled
        ? `On: ${trial.credits} free credits per new workspace, on ${trial.engineName ?? "the trial engine"}.`
        : "Off: new visitors cannot try TAK-TAK for free.",
      settings: ["TAKBOT_TRIAL_ENABLED", "TAKBOT_TRIAL_CREDITS", "TAKBOT_TRIAL_ENGINE"],
    },
    {
      key: "checkout",
      on: aiCreditsCheckoutEnabled(),
      label: "Selling AI credits (card checkout)",
      detail: aiCreditsCheckoutEnabled()
        ? "On: clients can buy credit packs by card."
        : "Off: clients cannot buy AI credits; only credits you grant can be used.",
      settings: ["AI_CREDITS_CHECKOUT_ENABLED", "STRIPE_AI_CREDITS_WEBHOOK_SECRET"],
    },
    {
      key: "gateway",
      on: gatewayMissing.length === 0,
      label: "TAKATAK AI Gateway (agents and Growth Suite tasks)",
      detail: gatewayMissing.length === 0 ? "Configured." : `Not configured: ${gatewayMissing.join(", ")} missing.`,
      settings: [...AI_GATEWAY_ENV],
    },
    {
      key: "key_storage",
      on: providerKeysStorageReady(),
      label: "Saving provider keys from the dashboard",
      detail: providerKeysStorageReady()
        ? "On: keys entered on the provider keys screen are encrypted and stored."
        : "Off: keys can only come from server variables.",
      settings: ["GROWTH_TOKEN_ENCRYPTION_KEY_V1"],
    },
  ];

  if (!prisma) {
    return {
      generatedAt: new Date(now).toISOString(),
      databaseAvailable: false,
      engines,
      switches,
      credits: null,
      agents: AI_AGENTS.map((agent) => emptyAgent(agent)),
      recentRuns: [],
      providerEvents30d: null,
    };
  }

  const [credits, agents, recentRuns, providerEvents30d] = await Promise.all([
    creditTotals(prisma, since).catch(() => null),
    agentTotals(prisma, since).catch(() => AI_AGENTS.map((agent) => emptyAgent(agent))),
    latestRuns(prisma).catch(() => []),
    prisma.aiProviderEvent.count({ where: { createdAt: { gte: since } } }).catch(() => null),
  ]);

  return {
    generatedAt: new Date(now).toISOString(),
    databaseAvailable: true,
    engines,
    switches,
    credits,
    agents,
    recentRuns,
    providerEvents30d,
  };
}

type Db = NonNullable<ReturnType<typeof getPrisma>>;

function emptyAgent(agent: (typeof AI_AGENTS)[number]): AiControlAgent {
  return {
    key: agent.key,
    name: agent.name,
    mission: agent.mission,
    alwaysRequiresApproval: Boolean(agent.alwaysRequiresApproval),
    enabledWorkspaces: 0,
    runs30d: 0,
    completed30d: 0,
    failed30d: 0,
    awaitingApproval: 0,
    lastRunAt: null,
  };
}

async function creditTotals(prisma: Db, since: Date) {
  const [accounts, entries] = await Promise.all([
    prisma.aiCreditAccount.aggregate({ _count: { _all: true }, _sum: { balance: true } }),
    prisma.aiCreditEntry.groupBy({ by: ["reason"], where: { createdAt: { gte: since } }, _sum: { delta: true }, _count: { _all: true } }),
  ]);
  const sum = (reason: string) => entries.find((entry) => entry.reason === reason)?._sum.delta ?? 0;
  const debitRow = entries.find((entry) => entry.reason === "debit");
  return {
    accounts: accounts._count._all,
    totalBalance: accounts._sum.balance ?? 0,
    spent30d: Math.abs(sum("debit")) - Math.abs(sum("refund")),
    granted30d: sum("grant"),
    purchased30d: sum("purchase"),
    debits30d: debitRow?._count._all ?? 0,
  };
}

async function agentTotals(prisma: Db, since: Date): Promise<AiControlAgent[]> {
  const [enabled, runs, waiting, last] = await Promise.all([
    prisma.aiAgentSetting.groupBy({ by: ["agentKey"], where: { enabled: true }, _count: { _all: true } }),
    prisma.aiAgentRun.groupBy({ by: ["agentKey", "status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.aiAgentRun.groupBy({ by: ["agentKey"], where: { status: "awaiting_approval" }, _count: { _all: true } }),
    prisma.aiAgentRun.groupBy({ by: ["agentKey"], _max: { createdAt: true } }),
  ]);
  return AI_AGENTS.map((agent) => {
    const mine = runs.filter((row) => row.agentKey === agent.key);
    const count = (status: string) => mine.find((row) => row.status === status)?._count._all ?? 0;
    return {
      ...emptyAgent(agent),
      enabledWorkspaces: enabled.find((row) => row.agentKey === agent.key)?._count._all ?? 0,
      runs30d: mine.reduce((total, row) => total + row._count._all, 0),
      completed30d: count("completed"),
      failed30d: count("failed"),
      awaitingApproval: waiting.find((row) => row.agentKey === agent.key)?._count._all ?? 0,
      lastRunAt: last.find((row) => row.agentKey === agent.key)?._max.createdAt?.toISOString() ?? null,
    };
  });
}

async function latestRuns(prisma: Db): Promise<AiControlRun[]> {
  const rows = await prisma.aiAgentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      agentKey: true,
      status: true,
      trigger: true,
      creditsDebited: true,
      createdAt: true,
      error: true,
      client: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    agentKey: row.agentKey,
    status: row.status,
    trigger: row.trigger,
    workspace: row.client?.name ?? "—",
    creditsDebited: row.creditsDebited,
    createdAt: row.createdAt.toISOString(),
    // Errors are shown to platform staff only, shortened.
    error: row.error ? row.error.slice(0, 160) : null,
  }));
}
