import type { TenantAccess } from "@/lib/security/tenant-access";
import type { SidebarServiceModule } from "@/lib/services/service-modules";

/**
 * Who sees "ALKAO — Billetterie". It needs no database change: the TAKATAK
 * Client ids allowed to use ALKAO are listed in ALKAO_TICKETING_CLIENT_IDS
 * (comma-separated). Unset or empty: nobody sees the menu, and the page
 * redirects to /dashboard.
 *
 * Hiding the menu is not a security measure. ALKAO checks the user's token,
 * Client membership, role and Ticketing entitlement on every call.
 */
export function parseAlkaoClientIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)),
  );
}

export function hasAlkaoTicketing(
  access: TenantAccess,
  allowed: Set<string> = parseAlkaoClientIds(process.env.ALKAO_TICKETING_CLIENT_IDS),
): boolean {
  return (
    access.mode === "client_scoped" &&
    allowed.has(access.activeClientId.toLowerCase())
  );
}

export function getAlkaoServiceModules(
  access: TenantAccess,
): SidebarServiceModule[] {
  return hasAlkaoTicketing(access) ? ["ticketing"] : [];
}
