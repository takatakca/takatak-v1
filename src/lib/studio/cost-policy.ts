/**
 * Pure Studio planning policy. Retail credits and supplier money are different
 * units. Inputs describing rates, eligibility and approvals must come from V1
 * server configuration/evidence, never a customer request or imported pack.
 * This module does not debit credits, contact providers or authorize publishing.
 */
export const STUDIO_MAX_PROVIDER_TASKS = 28;
export const STUDIO_MAX_COLLABORATORS = 4;
export const STUDIO_MAX_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TRACKS = ["video", "book", "music", "social"] as const;
type Track = (typeof TRACKS)[number];
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

/** One writer call per format/day; collaborating agents share that result. */
export function quoteStudioPlanCost(input: {
  tracks: readonly string[];
  days: number;
  retailCreditsPerDraft: number;
  budgetCredits: number;
  collaboratorCount?: number;
  maxProviderTasks?: number;
}) {
  const collaborators = input.collaboratorCount ?? 1;
  const maxTasks = input.maxProviderTasks ?? STUDIO_MAX_PROVIDER_TASKS;
  if (!Array.isArray(input.tracks) || input.tracks.length < 1 || input.tracks.length > TRACKS.length ||
      input.tracks.some(track => !TRACKS.includes(track as Track)) || new Set(input.tracks).size !== input.tracks.length ||
      !integer(input.days, 1, 7) || !integer(input.retailCreditsPerDraft, 1, 1000) ||
      !integer(input.budgetCredits, 1, 1000) || !integer(collaborators, 1, STUDIO_MAX_COLLABORATORS) ||
      !integer(maxTasks, 1, STUDIO_MAX_PROVIDER_TASKS)) {
    return { ok: false as const, code: "invalid_plan" as const };
  }
  const providerTasks = input.days * input.tracks.length;
  const retailCreditCeiling = providerTasks * input.retailCreditsPerDraft;
  if (providerTasks > maxTasks) return { ok: false as const, code: "provider_task_limit" as const };
  if (retailCreditCeiling > input.budgetCredits) return { ok: false as const, code: "retail_budget_exceeded" as const };
  return {
    ok: true as const,
    providerTasks,
    collaboratorCount: collaborators,
    retailCreditsPerDraft: input.retailCreditsPerDraft,
    retailCreditCeiling,
    budgetCredits: input.budgetCredits,
    // No supplier price card or realized customer revenue is implied by credits.
    providerCostMicros: null,
    marginMicros: null,
    providerCostStatus: "unknown" as const,
    automaticEscalation: false as const,
    reservesCredits: false as const,
  };
}

export interface StudioUnitRate {
  version: string;
  currency: string;
  inputMicrosPerMillionTokens: number;
  outputMicrosPerMillionTokens: number;
  fixedMicros: number;
  verifiedAtMs: number;
  expiresAtMs: number;
  sourceUrl: string;
  /** Server audit confirms this bound includes all request-specific chargeable units. */
  completeForRequest: boolean;
}
export interface StudioCostRoute {
  id: string;
  engine: string;
  model: string;
  eligible: boolean;
  available: boolean;
  requiresApproval: boolean;
  rate: StudioUnitRate | null;
}
export interface StudioRouteApproval {
  routeId: string;
  rateVersion: string;
  maxProviderCostMicros: number;
}
function validRate(rate: StudioUnitRate, nowMs: number, currency: string) {
  let source: URL;
  try { source = new URL(rate.sourceUrl); } catch { return false; }
  return rate.completeForRequest === true && bounded(rate.version, 120) && rate.currency === currency && /^[A-Z]{3}$/.test(currency) &&
    source.protocol === "https:" && !source.username && !source.password &&
    integer(rate.inputMicrosPerMillionTokens, 0, 1_000_000_000_000) &&
    integer(rate.outputMicrosPerMillionTokens, 0, 1_000_000_000_000) &&
    integer(rate.fixedMicros, 0, 1_000_000_000_000) &&
    integer(rate.verifiedAtMs, 0, nowMs) && integer(rate.expiresAtMs, nowMs + 1, Number.MAX_SAFE_INTEGER) &&
    nowMs - rate.verifiedAtMs <= STUDIO_MAX_RATE_AGE_MS;
}
/** Conservative token-bound estimate, rounded UP to a whole currency micro. */
export function estimateStudioProviderCost(rate: StudioUnitRate, input: {
  nowMs: number; currency: string; maxInputTokens: number; maxOutputTokens: number;
}): number | null {
  if (!integer(input.nowMs, 0, Number.MAX_SAFE_INTEGER - 1) ||
      !integer(input.maxInputTokens, 1, 1_000_000) || !integer(input.maxOutputTokens, 1, 1_000_000) ||
      !validRate(rate, input.nowMs, input.currency)) return null;
  const numerator = BigInt(input.maxInputTokens) * BigInt(rate.inputMicrosPerMillionTokens) +
    BigInt(input.maxOutputTokens) * BigInt(rate.outputMicrosPerMillionTokens);
  const total = (numerator + BigInt(999_999)) / BigInt(1_000_000) + BigInt(rate.fixedMicros);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}

/**
 * Cheapest eligible quoted engine/model. Unknown rates never mean free. A
 * premium/escalation route needs a matching server-verified rate-version grant.
 * The caller must enforce this exact model and output bound at execution time.
 */
export function cheapestStudioRoute(routes: readonly StudioCostRoute[], input: {
  nowMs: number; currency: string; maxInputTokens: number; maxOutputTokens: number;
  maxProviderCostMicros: number; approval?: StudioRouteApproval;
}) {
  if (!integer(input.maxProviderCostMicros, 0, Number.MAX_SAFE_INTEGER) ||
      new Set(routes.map(route => route.id)).size !== routes.length) {
    return { state: "blocked" as const, code: "invalid_cost_policy" as const };
  }
  const quoted = routes.filter(route => route.eligible === true && route.available === true && typeof route.requiresApproval === "boolean" && bounded(route.id, 120) &&
      bounded(route.engine, 80) && bounded(route.model, 160)).flatMap(route => {
    const cost = route.rate ? estimateStudioProviderCost(route.rate, input) : null;
    return cost !== null && cost <= input.maxProviderCostMicros ? [{ route, cost }] : [];
  }).sort((a, b) => a.cost - b.cost || a.route.id.localeCompare(b.route.id));
  const allowed = quoted.find(({route,cost}) => !route.requiresApproval ||
    (input.approval?.routeId === route.id && input.approval.rateVersion === route.rate?.version &&
     integer(input.approval.maxProviderCostMicros, cost, input.maxProviderCostMicros)));
  if (allowed) return {
    state: "selected" as const, routeId: allowed.route.id, engine: allowed.route.engine, model: allowed.route.model,
    providerCostCeilingMicros: allowed.cost, currency: input.currency, rateVersion: allowed.route.rate!.version,
    maxInputTokens: input.maxInputTokens, maxOutputTokens: input.maxOutputTokens,
  };
  if (quoted.length) return { state: "approval_required" as const, routeId: quoted[0].route.id,
    rateVersion: quoted[0].route.rate!.version, providerCostCeilingMicros: quoted[0].cost, currency: input.currency };
  return { state: "blocked" as const, code: "no_eligible_quoted_route" as const };
}

export interface StudioReuseScope {
  clientId: string;
  projectId: string;
  briefDigest: string;
  briefVersion: number;
  track: Track;
  taskRevision: string;
}
/** Exact scope, not semantic similarity: never share customer drafts across tenants. */
export function studioReuseKey(scope: StudioReuseScope): string | null {
  if (!bounded(scope.clientId, 80) || !bounded(scope.projectId, 80) ||
      !/^[a-f0-9]{64}$/i.test(scope.briefDigest) || !integer(scope.briefVersion, 1, Number.MAX_SAFE_INTEGER) ||
      !TRACKS.includes(scope.track) || !bounded(scope.taskRevision, 120)) return null;
  return `studio-reuse:v1:${JSON.stringify([scope.clientId, scope.projectId, scope.briefDigest.toLowerCase(),
    scope.briefVersion, scope.track, scope.taskRevision])}`;
}
export function reusableStudioArtifact(scope: StudioReuseScope, artifact: {
  scope: StudioReuseScope; outputId: string; state: string; archived: boolean;
}): boolean {
  const key = studioReuseKey(scope);
  return key !== null && key === studioReuseKey(artifact.scope) && bounded(artifact.outputId, 80) &&
    artifact.state === "completed" && artifact.archived === false;
}
