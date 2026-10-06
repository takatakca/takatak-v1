// GROUPE TAKATAK Billing — TAKATAK identity -> Facturations service identity.
// Pure module. Roles are always derived server-side from the TAKATAK platform
// role; a browser field can never choose OWNER.

import type { FacturationsRole } from "./service-token";

export type TakatakPlatformRole = "owner" | "admin" | "user";

/**
 * GROUPE TAKATAK is the single Facturations business. Platform owners act as
 * the Facturations OWNER (draft creation, review data); platform admins are
 * STAFF (read-only summaries). Everyone else has no billing identity.
 */
export function facturationsRoleForPlatformRole(
  role: TakatakPlatformRole | null | undefined,
): FacturationsRole | null {
  if (role === "owner") {
    return "OWNER";
  }

  if (role === "admin") {
    return "STAFF";
  }

  return null;
}

/**
 * Stable subject claim. Prefers the cross-app MasterIdentity, falling back to
 * the TAKATAK profile id. Both are UUIDs, never emails or phone numbers.
 */
export function facturationsSubject(input: {
  masterIdentityId: string | null;
  profileId: string;
}): string {
  return input.masterIdentityId
    ? `takatak:mi:${input.masterIdentityId}`
    : `takatak:profile:${input.profileId}`;
}

/**
 * Server-side system identity used ONLY for read-only lookups made on behalf
 * of a client workspace (its own issued invoices). Never derived from, or
 * exposed to, a browser.
 */
export const FACTURATIONS_CLIENT_INVOICE_READER = Object.freeze({
  subject: "takatak:system:client-invoice-center",
  role: "OWNER" as const,
});
