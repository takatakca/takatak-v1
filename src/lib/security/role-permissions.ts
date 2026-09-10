import {
  ALL_PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type Permission,
  type RoleKey,
} from "@/lib/security/roles";

export const WORKSPACE_ROLE_ORDER: RoleKey[] = [
  "owner",
  "admin",
  "manager",
  "editor",
  "staff",
  "viewer",
];

export const VIEW_PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  view_dashboard: "Analytics view",
  view_social: "Social view",
  view_reports: "Reports view",
  view_team: "Team view",
  view_activity_log: "Activity log view",
  view_admin: "Admin view",
};

export const EDIT_PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  manage_clients: "Clients",
  manage_brands: "Brands",
  manage_services: "Services",
  manage_integrations: "Integrations",
  manage_jobs: "Jobs",
  invite_users: "Invite users",
  manage_users: "Users",
  suspend_users: "Suspend users",
  delete_users: "Remove users",
  manage_roles: "Roles",
  manage_permissions: "Permissions",
  manage_settings: "Settings",
  create_content: "Schedule and publish posts",
  edit_content: "Edit content",
  approve_content: "Review posts",
  manage_social_accounts: "Social accounts",
};

export function permissionLabel(permission: Permission): string {
  return (
    VIEW_PERMISSION_LABELS[permission] ??
    EDIT_PERMISSION_LABELS[permission] ??
    permission
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function parsePermissionArray(value: unknown): Permission[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const permissions = new Set<Permission>();

  for (const item of value) {
    if (
      typeof item !== "string" ||
      !ALL_PERMISSIONS.includes(item as Permission)
    ) {
      return null;
    }

    permissions.add(item as Permission);
  }

  return ALL_PERMISSIONS.filter((permission) => permissions.has(permission));
}

export function normalizeRoleName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim().replace(/\s+/g, " ");

  if (name.length < 2 || name.length > 60) {
    return null;
  }

  return name;
}

export function isReservedRoleName(name: string): boolean {
  const lower = name.trim().toLowerCase();

  return (
    WORKSPACE_ROLE_ORDER.includes(lower as RoleKey) ||
    Object.values(ROLE_LABELS).some((label) => label.toLowerCase() === lower)
  );
}

export function resolveMembershipBasePermissions(input: {
  role: RoleKey;
  customRolePermissions?: Permission[] | null;
  roleOverridePermissions?: Permission[] | null;
}): Permission[] {
  if (Array.isArray(input.customRolePermissions)) {
    return [...input.customRolePermissions];
  }

  if (input.role === "owner") {
    return [...ROLE_PERMISSIONS.owner];
  }

  if (input.roleOverridePermissions) {
    return [...input.roleOverridePermissions];
  }

  return [...ROLE_PERMISSIONS[input.role]];
}
