import "server-only";

// Growth Suite — presence-only status resolution. Reads env var presence on the
// server; never returns values and never calls a provider.

import { AI_GATEWAY_ENV, AI_PROVIDERS } from "./ai-engine";
import { CONNECTORS } from "./connectors";
import type { ConnectorDef, ConnectorState, ConnectorStatus } from "./types";

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function resolveConnector(def: ConnectorDef): ConnectorStatus {
  if (def.kind === "built_in") return { ...def, state: "built_in", missing: [] };
  if (def.kind === "planned") return { ...def, state: "planned", missing: [] };
  const missing = def.env.filter((name) => !hasEnv(name));
  const state: ConnectorState = missing.length === 0 ? "configured_untested" : "not_configured";
  return { ...def, state, missing };
}

export function getConnectorStatuses(): ConnectorStatus[] {
  return CONNECTORS.map(resolveConnector);
}

export function getConnectorStatusMap(): Map<string, ConnectorStatus> {
  return new Map(getConnectorStatuses().map((s) => [s.key, s]));
}

export interface AiProviderPresence {
  key: string;
  name: string;
  configured: boolean;
}

export interface AiEngineStatus {
  gateway: { configured: boolean; missing: string[] };
  providers: AiProviderPresence[];
  configuredCount: number;
}

export function getAiEngineStatus(): AiEngineStatus {
  const gatewayMissing = AI_GATEWAY_ENV.filter((name) => !hasEnv(name));
  const providers = AI_PROVIDERS.map((p) => ({ key: p.key, name: p.name, configured: hasEnv(p.env) }));
  return {
    gateway: { configured: gatewayMissing.length === 0, missing: [...gatewayMissing] },
    providers,
    configuredCount: providers.filter((p) => p.configured).length,
  };
}
