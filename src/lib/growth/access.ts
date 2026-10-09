import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_STATUS_HEADER } from "@/lib/auth/session-user";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { TenantAccess } from "@/lib/security/tenant-access";

export interface GrowthAccess {
  access: TenantAccess;
  /** Platform operators see env var names and setup steps; clients see states only. */
  showSetupDetails: boolean;
}

function safeReturnPath(returnPath: string): string {
  return returnPath.startsWith("/dashboard") && !returnPath.startsWith("//") ? returnPath : "/dashboard";
}

/**
 * Growth Suite pages render the platform catalog (connectors, AI engine,
 * pricing), not tenant rows, so platform admins may open them without
 * selecting a client. Anything tenant-scoped must still use
 * requireWorkspacePermission.
 */
export async function requireGrowthAccess(returnPath: string): Promise<GrowthAccess> {
  const { access } = await getServerAccessContext();

  if (access.mode === "denied" && access.reason === "not_authenticated") {
    if ((await headers()).get(AUTH_STATUS_HEADER) === "network") redirect("/dashboard");
    redirect(`/login?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  }

  if (access.mode === "selection_required") {
    redirect(`/dashboard/select-client?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  }

  if (!hasEffectivePermission(access, "view_dashboard")) redirect("/dashboard");

  return {
    access,
    showSetupDetails: access.mode === "platform_admin" || access.mode === "foundation_demo",
  };
}
