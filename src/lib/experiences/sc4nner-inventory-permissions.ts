import { resolveMembershipBasePermissions } from "@/lib/security/role-permissions";
import type { Permission, RoleKey } from "@/lib/security/roles";

/**
 * Pure mirror of the workspace gate's effective-permission computation for a
 * single membership (see `getEffectivePermissions` in
 * `src/lib/security/effective-permissions.ts` and the membership mapping in
 * `src/lib/security/tenant-access.ts`): base permissions for the role — a
 * custom role or a per-role override replaces the stock role set — plus the
 * membership's granted permissions, minus its denied permissions.
 *
 * Kept free of database and `server-only` imports so the SC4NNER bridge
 * contract tests can exercise the exact rule the dashboard gate applies.
 */
export function membershipGrantsPermission(input: {
  role: RoleKey;
  customRolePermissions?: Permission[] | null;
  roleOverridePermissions?: Permission[] | null;
  customPermissions?: readonly string[] | null;
  deniedPermissions?: readonly string[] | null;
  permission: Permission;
}): boolean {
  const base = resolveMembershipBasePermissions({
    role: input.role,
    customRolePermissions: input.customRolePermissions ?? null,
    roleOverridePermissions: input.roleOverridePermissions ?? null,
  });
  const granted = new Set<string>(base);
  for (const permission of input.customPermissions ?? []) granted.add(permission);
  for (const permission of input.deniedPermissions ?? []) granted.delete(permission);
  return granted.has(input.permission);
}
