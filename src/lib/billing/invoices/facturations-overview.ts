import "server-only";

// GROUPE TAKATAK Billing — admin overview of the Facturations connection.
// Shared by the admin page and the admin status API.

import { resolveFacturationsActor } from "@/lib/integrations/facturations/actor";
import {
  getFacturationsCapabilities,
  getFacturationsDashboard,
  listFacturationsDrafts,
  type FacturationsActor,
} from "@/lib/integrations/facturations/client";
import type {
  FacturationsCapabilities,
  FacturationsDashboard,
  FacturationsDraftPage,
  FacturationsFailureKind,
} from "@/lib/integrations/facturations/contract";
import {
  getFacturationsEnvStatus,
  type FacturationsEnvStatus,
} from "@/lib/integrations/facturations/env";
import type { TakatakPlatformRole } from "@/lib/integrations/facturations/identity";

export type RemoteSection<T> =
  | { available: true; data: T }
  | { available: false; reason: FacturationsFailureKind };

export interface FacturationsOverview {
  env: FacturationsEnvStatus;
  actorRole: FacturationsActor["role"] | null;
  capabilities: RemoteSection<FacturationsCapabilities>;
  dashboard: RemoteSection<FacturationsDashboard>;
  drafts: RemoteSection<FacturationsDraftPage>;
}

function unavailable<T>(reason: FacturationsFailureKind): RemoteSection<T> {
  return { available: false, reason };
}

export async function getFacturationsActorForAdmin(access: {
  profileId: string | null;
  role: TakatakPlatformRole | null;
}): Promise<FacturationsActor | null> {
  return resolveFacturationsActor({
    profileId: access.profileId,
    platformRole: access.role,
  });
}

export async function getFacturationsOverview(access: {
  profileId: string | null;
  role: TakatakPlatformRole | null;
}): Promise<FacturationsOverview> {
  const env = getFacturationsEnvStatus();

  if (!env.enabled || !env.configured) {
    const reason = env.enabled ? "not_configured" : "disabled";

    return {
      env,
      actorRole: null,
      capabilities: unavailable(reason),
      dashboard: unavailable(reason),
      drafts: unavailable(reason),
    };
  }

  const actor = await getFacturationsActorForAdmin(access);

  if (!actor) {
    return {
      env,
      actorRole: null,
      capabilities: unavailable("identity_unavailable"),
      dashboard: unavailable("identity_unavailable"),
      drafts: unavailable("identity_unavailable"),
    };
  }

  const [capabilities, dashboard, drafts] = await Promise.all([
    getFacturationsCapabilities(actor),
    getFacturationsDashboard(actor),
    listFacturationsDrafts(actor, 1, 10),
  ]);

  return {
    env,
    actorRole: actor.role,
    capabilities: capabilities.ok
      ? { available: true, data: capabilities.data }
      : unavailable(capabilities.kind),
    dashboard: dashboard.ok
      ? { available: true, data: dashboard.data }
      : unavailable(dashboard.kind),
    drafts: drafts.ok
      ? { available: true, data: drafts.data }
      : unavailable(drafts.kind),
  };
}
