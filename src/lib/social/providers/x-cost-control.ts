import "server-only";

export type XBillableOperation =
  | "profile.read"
  | "post.read"
  | "post.create"
  | "post.create_with_url";

export const X_PRICE_CATALOG_VERSION = "2026-10-09";

// USD micros. Keep the URL publication separate: X currently prices it
// differently and TAKATAK must never silently treat it as a normal post.
export const X_ESTIMATED_COST_USD_MICROS: Readonly<
  Record<XBillableOperation, number>
> = Object.freeze({
  "profile.read": 10_000,
  "post.read": 5_000,
  "post.create": 15_000,
  "post.create_with_url": 200_000,
});

export const X_CACHE_TTL_MS = Object.freeze({
  profile: 24 * 60 * 60 * 1_000,
  post: 15 * 60 * 1_000,
});

export type XCostDecision =
  | { allowed: true; estimatedCostUsdMicros: number; projectedUsdMicros: number }
  | {
      allowed: false;
      code:
        | "disabled"
        | "missing_budget"
        | "budget_exceeded"
        | "missing_idempotency_key";
      estimatedCostUsdMicros: number;
      projectedUsdMicros: number;
    };

export function classifyXPublishOperation(input: {
  text: string;
  urls?: readonly string[];
}): "post.create" | "post.create_with_url" {
  const containsUrl =
    (input.urls?.length ?? 0) > 0 || /https?:\/\/\S+/i.test(input.text);
  return containsUrl ? "post.create_with_url" : "post.create";
}

export function evaluateXCostGuard(input: {
  enabled: boolean;
  operation: XBillableOperation;
  monthlyBudgetUsdMicros: number;
  spentUsdMicros: number;
  idempotencyKey?: string;
}): XCostDecision {
  const estimatedCostUsdMicros = X_ESTIMATED_COST_USD_MICROS[input.operation];
  const projectedUsdMicros = input.spentUsdMicros + estimatedCostUsdMicros;

  if (!input.enabled) {
    return { allowed: false, code: "disabled", estimatedCostUsdMicros, projectedUsdMicros };
  }
  if (!Number.isSafeInteger(input.monthlyBudgetUsdMicros) || input.monthlyBudgetUsdMicros <= 0) {
    return { allowed: false, code: "missing_budget", estimatedCostUsdMicros, projectedUsdMicros };
  }
  if (input.operation.endsWith(".create") || input.operation === "post.create_with_url") {
    if (!input.idempotencyKey?.trim()) {
      return {
        allowed: false,
        code: "missing_idempotency_key",
        estimatedCostUsdMicros,
        projectedUsdMicros,
      };
    }
  }
  if (projectedUsdMicros > input.monthlyBudgetUsdMicros) {
    return {
      allowed: false,
      code: "budget_exceeded",
      estimatedCostUsdMicros,
      projectedUsdMicros,
    };
  }
  return { allowed: true, estimatedCostUsdMicros, projectedUsdMicros };
}

export function isXCacheFresh(input: {
  kind: keyof typeof X_CACHE_TTL_MS;
  cachedAt: Date | null;
  now?: Date;
}): boolean {
  if (!input.cachedAt) return false;
  const age = (input.now ?? new Date()).getTime() - input.cachedAt.getTime();
  return age >= 0 && age < X_CACHE_TTL_MS[input.kind];
}

export function createXCostAuditEvent(input: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  operation: XBillableOperation;
  decision: XCostDecision;
  idempotencyKey?: string;
}) {
  return {
    event: "x_api_cost_guard",
    provider: "x",
    priceCatalogVersion: X_PRICE_CATALOG_VERSION,
    clientId: input.clientId,
    businessBrandId: input.businessBrandId,
    socialAccountId: input.socialAccountId,
    operation: input.operation,
    estimatedCostUsdMicros: input.decision.estimatedCostUsdMicros,
    projectedUsdMicros: input.decision.projectedUsdMicros,
    allowed: input.decision.allowed,
    reason: input.decision.allowed ? "allowed" : input.decision.code,
    idempotencyKey: input.idempotencyKey ?? null,
  } as const;
}
