import { getEffectivePermissions, hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { RoleKey } from "@/lib/security/roles";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";
import type { UserManagementCapabilities } from "@/lib/team/team-data";

const ROLE_LEVELS: Record<RoleKey, number> = {
  owner: 6,
  admin: 5,
  manager: 4,
  editor: 3,
  staff: 2,
  viewer: 1,
};

const ROLE_OPTIONS: RoleKey[] = [
  "owner",
  "admin",
  "manager",
  "editor",
  "staff",
  "viewer",
];

export function getUserManagementCapabilities(
  access: ClientScopedAccess,
): UserManagementCapabilities {
  return {
    currentProfileId: access.profileId,
    allowedRoles: ROLE_OPTIONS.filter((candidateRole) => {
      if (candidateRole === "owner") {
        return access.role === "owner";
      }

      return ROLE_LEVELS[candidateRole] <= ROLE_LEVELS[access.role];
    }),
    assignablePermissions: getEffectivePermissions(access),
    canInvite: hasEffectivePermission(access, "invite_users"),
    canManageRoles: hasEffectivePermission(access, "manage_roles"),
    canManagePermissions: hasEffectivePermission(access, "manage_permissions"),
    canSuspendUsers: hasEffectivePermission(access, "suspend_users"),
    canDeleteUsers: hasEffectivePermission(access, "delete_users"),
  };
}

export function readUserManagementTab(
  value: string | string[] | undefined,
): "users" | "roles" {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "roles" ? "roles" : "users";
}
