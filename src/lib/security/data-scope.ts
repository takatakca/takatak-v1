// Phase 15A — Shared query-scope resolution for every client-facing data
// layer. This is the single choke point that turns TenantAccess into an
// explicit Prisma filter. Configured environments NEVER fall back to global
// mock data; only local foundation mode may.
// (server-only marker removed: these modules are server-side by usage —
// next/headers + Prisma — and must stay importable by tsx QA scripts.)
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "./access-context";
import type { TenantAccess } from "./tenant-access";
import { resolveTenantAccess } from "./tenant-access";

export type DataScope =
  | { kind: "mock"; label: string }
  | { kind: "db"; clientIds: string[] | null; label: string; allowMockFallback: boolean } // null = global (labeled platform view / foundation)
  | { kind: "unavailable"; label: string; reason: string };

const DENIED_LABELS: Record<string, string> = {
  not_authenticated: "Sign in to view this data.",
  profile_missing: "Your account profile could not be resolved. Contact your TAKATAK administrator.",
  profile_disabled: "This account is disabled. Contact your TAKATAK administrator.",
  membership_missing: "Your account is authenticated, but no TAKATAK client access has been assigned. Contact your TAKATAK administrator.",
  client_inactive: "The selected workspace is paused or archived.",
  client_not_allowed: "You do not have access to the requested client.",
  database_unavailable: "Data is temporarily unavailable.",
  production_foundation_blocked: "This deployment is not configured.",
  selection_required: "Select a client to view its data.",
};

export async function resolveDataScope(access?: TenantAccess): Promise<DataScope> {
  let resolved: TenantAccess;
  if (access) {
    resolved = access;
  } else {
    try {
      // Request context: cached once per request.
      resolved = (await getServerAccessContext()).access;
    } catch {
      // Non-request context (scripts/tools): resolve directly.
      resolved = await resolveTenantAccess(null);
    }
  }
  switch (resolved.mode) {
    case "foundation_demo":
      return getPrisma()
        ? { kind: "db", clientIds: null, label: "Database — local foundation demo (no tenant isolation active).", allowMockFallback: true }
        : { kind: "mock", label: "Mock foundation data — database not connected yet." };
    case "platform_admin":
      return { kind: "db", clientIds: null, label: "Global platform view — all clients (owner/admin).", allowMockFallback: false };
    case "client_scoped":
      return { kind: "db", clientIds: [resolved.activeClientId], label: "Client-scoped view — your assigned client only.", allowMockFallback: false };
    case "selection_required":
      return { kind: "unavailable", label: DENIED_LABELS.selection_required, reason: "selection_required" };
    case "denied":
      return { kind: "unavailable", label: DENIED_LABELS[resolved.reason] ?? "Access denied.", reason: resolved.reason };
  }
}

/** where-clause fragment for models with a clientId column. */
export function clientWhere(scope: { clientIds: string[] | null }): { clientId?: { in: string[] } } {
  return scope.clientIds ? { clientId: { in: scope.clientIds } } : {};
}
