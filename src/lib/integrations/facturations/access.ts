// Decides whether the current TAKATAK workspace session may read Facturations,
// and with which Facturations role. Inputs are server-resolved only: the
// tenant access (Supabase session → Profile → ClientMembership) and server
// configuration. Business id and role are never taken from the browser.

import type { RoleKey } from "@/lib/security/roles";
import type { TenantAccess } from "@/lib/security/tenant-access";

import type { FacturationsConfig } from "./config";
import type { FacturationsRole } from "./token";

export type FacturationsDeniedReason =
  | "workspace_required"
  | "role_not_allowed"
  | "workspace_not_linked";

export interface FacturationsPrincipal {
  clientId: string;
  businessId: string;
  subject: string;
  roles: readonly FacturationsRole[];
}

export type FacturationsAccessResult =
  | { ok: true; principal: FacturationsPrincipal }
  | { ok: false; reason: FacturationsDeniedReason };

/**
 * Billing data is financial: only workspace owners act as Facturations OWNER,
 * workspace admins get read-only STAFF, every other role is denied.
 */
export function facturationsRolesFor(
  role: RoleKey,
): readonly FacturationsRole[] | null {
  if (role === "owner") return ["OWNER"];
  if (role === "admin") return ["STAFF"];
  return null;
}

export function resolveFacturationsAccess(
  access: TenantAccess,
  config: Pick<FacturationsConfig, "clientBusinessMap">,
): FacturationsAccessResult {
  if (access.mode !== "client_scoped") {
    return { ok: false, reason: "workspace_required" };
  }

  const roles = facturationsRolesFor(access.role);
  if (!roles) return { ok: false, reason: "role_not_allowed" };

  const businessId = config.clientBusinessMap.get(
    access.activeClientId.toLowerCase(),
  );
  if (!businessId) return { ok: false, reason: "workspace_not_linked" };

  return {
    ok: true,
    principal: {
      clientId: access.activeClientId,
      businessId,
      subject: access.profileId,
      roles,
    },
  };
}
