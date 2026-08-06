import { redirect } from "next/navigation";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { Permission } from "@/lib/security/roles";
import type { TenantAccess } from "@/lib/security/tenant-access";

export type ClientScopedAccess = Extract<
  TenantAccess,
  {
    mode: "client_scoped";
  }
>;

function getSafeReturnPath(
  returnPath: string,
): string {
  if (
    !returnPath.startsWith("/dashboard") ||
    returnPath.startsWith("//")
  ) {
    return "/dashboard";
  }

  return returnPath;
}

export async function requireWorkspacePermission(
  permission: Permission,
  returnPath = "/dashboard",
): Promise<ClientScopedAccess> {
  const { access } =
    await getServerAccessContext();

  if (
    access.mode === "denied" &&
    access.reason === "not_authenticated"
  ) {
    const safeReturnPath =
      getSafeReturnPath(returnPath);

    redirect(
      `/login?next=${encodeURIComponent(
        safeReturnPath,
      )}`,
    );
  }

  if (access.mode === "selection_required") {
    redirect("/dashboard");
  }

  if (access.mode === "platform_admin") {
    const safeReturnPath =
      getSafeReturnPath(returnPath);
  
    redirect(
      `/dashboard/select-client?next=${encodeURIComponent(
        safeReturnPath,
      )}`,
    );
  }

  if (access.mode !== "client_scoped") {
    redirect("/dashboard");
  }

  if (
    !hasEffectivePermission(
      access,
      permission,
    )
  ) {
    redirect("/dashboard");
  }

  return access;
}