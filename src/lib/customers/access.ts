import { redirect } from "next/navigation";

import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { TenantAccess } from "@/lib/security/tenant-access";

export type CustomerDatabaseAccess =
  | Extract<TenantAccess, { mode: "foundation_demo" }>
  | Extract<TenantAccess, { mode: "platform_admin" }>
  | Extract<TenantAccess, { mode: "client_scoped" }>;

function safeReturnPath(path: string): string {
  return path.startsWith("/dashboard") && !path.startsWith("//")
    ? path
    : "/dashboard/customers";
}

/**
 * Customer intelligence is readable by normal workspace members with
 * dashboard access, but every database read is still tenant-scoped.
 * Platform owner/admin receives the intentionally-labelled global view.
 */
export async function requireCustomerDatabaseAccess(
  returnPath = "/dashboard/customers",
): Promise<CustomerDatabaseAccess> {
  const { access } = await getServerAccessContext();

  if (access.mode === "denied" && access.reason === "not_authenticated") {
    redirect(`/login?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  }

  if (access.mode === "selection_required") {
    redirect(
      `/dashboard/select-client?next=${encodeURIComponent(
        safeReturnPath(returnPath),
      )}`,
    );
  }

  if (
    access.mode !== "foundation_demo" &&
    access.mode !== "platform_admin" &&
    access.mode !== "client_scoped"
  ) {
    redirect("/dashboard");
  }

  if (!hasEffectivePermission(access, "view_dashboard")) {
    redirect("/dashboard");
  }

  return access;
}
