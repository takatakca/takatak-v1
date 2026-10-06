import "server-only";

import type { TenantAccess } from "@/lib/security/tenant-access";
import { redactSecrets } from "@/lib/security/redact";

import { resolveFacturationsAccess, type FacturationsDeniedReason } from "./access";
import {
  createFacturationsClient,
  FacturationsClientError,
  type FacturationsDraftPage,
  type FacturationsDraftSummary,
  type FacturationsErrorCode,
} from "./client";
import { readFacturationsConfig } from "./config";

export type FacturationsOverview =
  | { state: "disabled" }
  | { state: "not_configured" }
  | { state: "denied"; reason: FacturationsDeniedReason }
  | { state: "error"; code: FacturationsErrorCode }
  | {
      state: "ready";
      role: "OWNER" | "STAFF";
      summary: FacturationsDraftSummary;
      drafts: FacturationsDraftPage;
      standaloneUrl: string;
    };

/** Reads the draft-only Facturations overview for the active workspace. */
export async function loadFacturationsOverview(
  access: TenantAccess,
): Promise<FacturationsOverview> {
  const configResult = readFacturationsConfig();
  if (configResult.state === "disabled") return { state: "disabled" };
  if (configResult.state === "not_configured") {
    return { state: "not_configured" };
  }

  const { config } = configResult;
  const resolved = resolveFacturationsAccess(access, config);
  if (!resolved.ok) return { state: "denied", reason: resolved.reason };

  const client = createFacturationsClient({
    config,
    principal: resolved.principal,
  });

  try {
    const [summary, drafts] = await Promise.all([
      client.getDraftSummary(),
      client.listDrafts(1, 20),
    ]);
    return {
      state: "ready",
      role: resolved.principal.roles.includes("OWNER") ? "OWNER" : "STAFF",
      summary,
      drafts,
      standaloneUrl: `${config.origin}/internal/dashboard`,
    };
  } catch (error) {
    if (error instanceof FacturationsClientError) {
      return { state: "error", code: error.code };
    }
    console.error(
      "[facturations] overview failed:",
      redactSecrets(error instanceof Error ? error.message : "unknown_error"),
    );
    return { state: "error", code: "unavailable" };
  }
}
