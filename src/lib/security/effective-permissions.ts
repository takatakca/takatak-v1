import type { TenantAccess } from "@/lib/security/tenant-access";
import {
  type Permission,
  ROLE_PERMISSIONS,
} from "@/lib/security/roles";

export function getEffectivePermissions(
  access: TenantAccess,
): Permission[] {
  if (access.mode === "foundation_demo") {
    return [...ROLE_PERMISSIONS.owner];
  }

  if (
    access.mode !== "platform_admin" &&
    access.mode !== "client_scoped"
  ) {
    return [];
  }

  if (access.mode === "platform_admin") {
    return [...ROLE_PERMISSIONS.owner];
  }

  if (access.role === "owner" && !access.customRoleId) {
    return [...ROLE_PERMISSIONS.owner];
  }

  const basePermissions =
    access.roleBasePermissions ?? ROLE_PERMISSIONS[access.role];

  const permissions = new Set<Permission>([
    ...basePermissions,
    ...access.customPermissions,
  ]);

  for (const deniedPermission of access.deniedPermissions) {
    permissions.delete(deniedPermission);
  }

  return Array.from(permissions);
}

export function hasEffectivePermission(
  access: TenantAccess,
  permission: Permission,
): boolean {
  return getEffectivePermissions(access).includes(permission);
}

export function hasEveryEffectivePermission(
  access: TenantAccess,
  permissions: Permission[],
): boolean {
  const effectivePermissions = new Set(
    getEffectivePermissions(access),
  );

  return permissions.every((permission) =>
    effectivePermissions.has(permission),
  );
}

export function hasAnyEffectivePermission(
  access: TenantAccess,
  permissions: Permission[],
): boolean {
  const effectivePermissions = new Set(
    getEffectivePermissions(access),
  );

  return permissions.some((permission) =>
    effectivePermissions.has(permission),
  );
}