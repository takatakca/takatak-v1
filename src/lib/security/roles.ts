import type { User } from "@supabase/supabase-js";

/**
 * Platform authority stored on Profile.role.
 *
 * A normal authenticated account is always "user" unless a
 * Platform Owner explicitly promotes it.
 */
export type PlatformRoleKey =
  | "user"
  | "admin"
  | "owner";

export const PLATFORM_ROLE_LABELS: Record<
  PlatformRoleKey,
  string
> = {
  user: "User",
  admin: "Platform Admin",
  owner: "Platform Owner",
};

const VALID_PLATFORM_ROLES: PlatformRoleKey[] = [
  "user",
  "admin",
  "owner",
];

export function isPlatformRoleKey(
  value: unknown,
): value is PlatformRoleKey {
  return (
    typeof value === "string" &&
    VALID_PLATFORM_ROLES.includes(
      value as PlatformRoleKey,
    )
  );
}

/**
 * Workspace authority stored on:
 *
 * ClientMembership.role
 * UserInvitation.role
 */
export type WorkspaceRoleKey =
  | "owner"
  | "admin"
  | "manager"
  | "editor"
  | "staff"
  | "viewer";

/**
 * Backward-compatible workspace role name.
 *
 * Existing team, permission, and workspace modules can
 * continue importing RoleKey while the architecture now
 * clearly separates platform and workspace authority.
 */
export type RoleKey = WorkspaceRoleKey;

export const ROLE_LABELS: Record<RoleKey, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  editor: "Editor",
  staff: "Staff",
  viewer: "Viewer",
};

export type Permission =
  | "view_dashboard"
  | "manage_clients"
  | "manage_brands"
  | "manage_services"
  | "manage_integrations"
  | "manage_jobs"
  | "view_team"
  | "invite_users"
  | "manage_users"
  | "suspend_users"
  | "delete_users"
  | "manage_roles"
  | "manage_permissions"
  | "view_activity_log"
  | "view_admin"
  | "manage_settings"
  | "create_content"
  | "edit_content"
  | "approve_content"
  | "view_reports"
  | "view_social"
  | "manage_social_accounts";

export const ALL_PERMISSIONS: Permission[] = [
  "view_dashboard",
  "manage_clients",
  "manage_brands",
  "manage_services",
  "manage_integrations",
  "manage_jobs",
  "view_team",
  "invite_users",
  "manage_users",
  "suspend_users",
  "delete_users",
  "manage_roles",
  "manage_permissions",
  "view_activity_log",
  "view_admin",
  "manage_settings",
  "create_content",
  "edit_content",
  "approve_content",
  "view_reports",
  "view_social",
  "manage_social_accounts",
];

export const ROLE_PERMISSIONS: Record<
  RoleKey,
  Permission[]
> = {
  owner: ALL_PERMISSIONS,

  admin: ALL_PERMISSIONS.filter(
    (permission) =>
      permission !== "delete_users" &&
      permission !== "manage_permissions",
  ),

  manager: [
    "view_dashboard",
    "manage_brands",
    "manage_services",
    "view_team",
    "invite_users",
    "manage_users",
    "view_activity_log",
    "manage_settings",
    "view_social",
    "manage_social_accounts",
    "create_content",
    "edit_content",
    "approve_content",
    "view_reports",
  ],

  editor: [
    "view_dashboard",
    "view_social",
    "create_content",
    "edit_content",
    "approve_content",
    "view_reports",
  ],

  staff: [
    "view_dashboard",
    "view_social",
    "create_content",
    "edit_content",
    "view_reports",
  ],

  viewer: [
    "view_dashboard",
    "view_social",
    "view_reports",
  ],
};

export const MODULE_ACCESS: Record<
  string,
  Permission
> = {
  "/dashboard": "view_dashboard",
  "/dashboard/clients": "manage_clients",
  "/dashboard/brands": "manage_brands",
  "/dashboard/locations": "manage_brands",
  "/dashboard/services": "manage_services",
  "/dashboard/social": "view_social",
  "/dashboard/integrations": "manage_integrations",
  "/dashboard/jobs": "manage_jobs",
  "/dashboard/activity": "view_activity_log",
  "/dashboard/team": "view_team",
  "/dashboard/admin": "view_admin",
  "/dashboard/settings": "manage_settings",
};

const VALID_ROLES: RoleKey[] = [
  "owner",
  "admin",
  "manager",
  "editor",
  "staff",
  "viewer",
];

export function isRoleKey(
  value: unknown,
): value is RoleKey {
  return (
    typeof value === "string" &&
    VALID_ROLES.includes(value as RoleKey)
  );
}

/**
 * Legacy display helper only.
 *
 * Supabase metadata is never trusted for authorization.
 */
export function roleForUser(
  user: User | null,
): RoleKey | null {
  if (!user) {
    return null;
  }

  const rawRole =
    user.user_metadata?.takatak_role;

  return isRoleKey(rawRole)
    ? rawRole
    : null;
}

export function hasPermission(
  role: RoleKey | null,
  permission: Permission,
): boolean {
  if (!role) {
    return false;
  }

  return ROLE_PERMISSIONS[role].includes(
    permission,
  );
}

export function canAccessModule(
  role: RoleKey | null,
  href: string,
): boolean {
  const requiredPermission =
    MODULE_ACCESS[href];

  if (!requiredPermission) {
    return true;
  }

  return hasPermission(
    role,
    requiredPermission,
  );
}