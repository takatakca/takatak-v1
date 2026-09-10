import { resolveEffectiveSocialEntitlements } from "@/lib/billing/social";
import { listConnectedPlatformIcons } from "@/lib/brands/brand-display-image";
import { getPrisma } from "@/lib/db/prisma";
import type { Permission, RoleKey } from "@/lib/security/roles";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

export type WorkspaceMemberSummary = {
  membershipId: string;
  profileId: string;
  authUserId: string | null;
  displayName: string | null;
  email: string | null;
  role: RoleKey;
  customRoleId: string | null;
  customRoleName: string | null;
  status: "active" | "suspended";
  customPermissions: Permission[];
  deniedPermissions: Permission[];
  joinedAt: string;
};

export type WorkspaceInvitationSummary = {
  invitationId: string;
  email: string;
  role: RoleKey;
  customRoleId: string | null;
  customRoleName: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  customPermissions: Permission[];
  deniedPermissions: Permission[];
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
};

export type WorkspaceCustomRoleSummary = {
  id: string;
  name: string;
  permissions: Permission[];
  createdAt: string;
};

export type WorkspaceBrandSummary = {
  id: string;
  name: string;
  status: string;
  connectedPlatforms: string[];
};

export type UserManagementTab = "users" | "roles";

export type UserManagementCapabilities = {
  currentProfileId: string;
  allowedRoles: RoleKey[];
  assignablePermissions: Permission[];
  canInvite: boolean;
  canManageRoles: boolean;
  canManagePermissions: boolean;
  canSuspendUsers: boolean;
  canDeleteUsers: boolean;
};

export type WorkspaceTeamData =
  | {
      source: "database";
      clientId: string;
      clientName: string;
      members: WorkspaceMemberSummary[];
      invitations: WorkspaceInvitationSummary[];
      brands: WorkspaceBrandSummary[];
      customRoleDefinitions: WorkspaceCustomRoleSummary[];
      systemRoleOverrides: Partial<Record<RoleKey, Permission[]>>;
      planName: string;
      teamManagement: boolean;
      customRoles: boolean;
    }
  | {
      source: "unavailable";
      message: string;
      clientId: string;
      clientName: null;
      members: [];
      invitations: [];
      brands: [];
      customRoleDefinitions: [];
      systemRoleOverrides: Partial<Record<RoleKey, Permission[]>>;
      planName: null;
      teamManagement: false;
      customRoles: false;
    };

function unavailableTeamData(
  clientId: string,
  message: string,
): Extract<WorkspaceTeamData, { source: "unavailable" }> {
  return {
    source: "unavailable",
    message,
    clientId,
    clientName: null,
    members: [],
    invitations: [],
    brands: [],
    customRoleDefinitions: [],
    systemRoleOverrides: {},
    planName: null,
    teamManagement: false,
    customRoles: false,
  };
}

export async function getWorkspaceTeamData(
  access: ClientScopedAccess,
): Promise<WorkspaceTeamData> {
  const prisma = getPrisma();

  if (!prisma) {
    return unavailableTeamData(
      access.activeClientId,
      "The database is unavailable.",
    );
  }

  try {
    const client = await prisma.client.findUnique({
      where: {
        id: access.activeClientId,
      },
      select: {
        id: true,
        name: true,
        memberships: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            profileId: true,
            role: true,
            customRoleId: true,
            customRole: {
              select: {
                id: true,
                name: true,
              },
            },
            status: true,
            customPermissions: true,
            deniedPermissions: true,
            createdAt: true,
            profile: {
              select: {
                authUserId: true,
                displayName: true,
                email: true,
              },
            },
          },
        },
        userInvitations: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            email: true,
            role: true,
            customRoleId: true,
            customRole: {
              select: {
                id: true,
                name: true,
              },
            },
            status: true,
            customPermissions: true,
            deniedPermissions: true,
            expiresAt: true,
            createdAt: true,
            invitedBy: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        },
        businessBrands: {
          where: {
            status: { notIn: ["archived", "frozen"] },
          },
          select: {
            id: true,
            name: true,
            status: true,
          },
          orderBy: {
            name: "asc",
          },
        },
        socialAccounts: {
          where: {
            status: "connected",
            businessBrandId: { not: null },
          },
          select: {
            businessBrandId: true,
            platform: true,
            accessStatus: true,
          },
        },
        customRoles: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            name: true,
            permissions: true,
            createdAt: true,
          },
        },
        rolePermissionOverrides: {
          select: {
            role: true,
            permissions: true,
          },
        },
        subscription: {
          select: {
            status: true,
            planCode: true,
            planName: true,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    if (!client) {
      return unavailableTeamData(
        access.activeClientId,
        "The selected workspace could not be found.",
      );
    }

    const { entitlements } = resolveEffectiveSocialEntitlements({
      status: client.subscription?.status,
      planCode: client.subscription?.planCode,
      cancelAtPeriodEnd: client.subscription?.cancelAtPeriodEnd,
      currentPeriodEnd: client.subscription?.currentPeriodEnd,
    });

    return {
      source: "database",
      clientId: client.id,
      clientName: client.name,
      members: client.memberships.map((membership) => ({
        membershipId: membership.id,
        profileId: membership.profileId,
        authUserId: membership.profile.authUserId,
        displayName: membership.profile.displayName,
        email: membership.profile.email,
        role: membership.role,
        customRoleId: membership.customRoleId,
        customRoleName: membership.customRole?.name ?? null,
        status: membership.status,
        customPermissions:
          membership.customPermissions as Permission[],
        deniedPermissions:
          membership.deniedPermissions as Permission[],
        joinedAt: membership.createdAt.toISOString(),
      })),
      invitations: client.userInvitations.map((invitation) => ({
        invitationId: invitation.id,
        email: invitation.email,
        role: invitation.role,
        customRoleId: invitation.customRoleId,
        customRoleName: invitation.customRole?.name ?? null,
        status: invitation.status,
        customPermissions:
          invitation.customPermissions as Permission[],
        deniedPermissions:
          invitation.deniedPermissions as Permission[],
        invitedBy:
          invitation.invitedBy?.displayName ??
          invitation.invitedBy?.email ??
          null,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      })),
      brands: client.businessBrands.map((brand) => {
        const platforms = client.socialAccounts
          .filter((account) => {
            if (account.businessBrandId !== brand.id) {
              return false;
            }
            if (account.platform === "facebook") {
              return account.accessStatus === "selected";
            }
            return true;
          })
          .map((account) => account.platform);

        return {
          id: brand.id,
          name: brand.name,
          status: brand.status,
          connectedPlatforms: listConnectedPlatformIcons(platforms),
        };
      }),
      customRoleDefinitions: client.customRoles.map((role) => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions as Permission[],
        createdAt: role.createdAt.toISOString(),
      })),
      systemRoleOverrides: Object.fromEntries(
        client.rolePermissionOverrides.map((override) => [
          override.role,
          override.permissions as Permission[],
        ]),
      ),
      planName: entitlements.planName,
      teamManagement: entitlements.teamManagement,
      customRoles: entitlements.customRoles,
    };
  } catch (error) {
    console.error(
      "[team-data] Workspace team query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return unavailableTeamData(
      access.activeClientId,
      "Team data is temporarily unavailable.",
    );
  }
}