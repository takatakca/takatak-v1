import type {
  Permission,
  PlatformRoleKey,
  RoleKey,
} from "@/lib/security/roles";

export interface SessionSnapshot {
  configured: boolean;
  profileId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;

  /**
   * Workspace role only.
   *
   * Null when no workspace is selected.
   */
  role: RoleKey | null;

  effectivePermissions: Permission[];

  /**
   * Global platform role.
   *
   * This does not grant a workspace role.
   */
  platformRole: PlatformRoleKey | null;

  accessMode:
    | "foundation_demo"
    | "platform_admin"
    | "client_scoped";

  activeClientId: string | null;
  activeClientName: string | null;
}