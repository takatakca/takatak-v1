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
  status: "active" | "suspended";
  customPermissions: Permission[];
  deniedPermissions: Permission[];
  joinedAt: string;
};

export type WorkspaceInvitationSummary = {
  invitationId: string;
  email: string;
  role: RoleKey;
  status: "pending" | "accepted" | "expired" | "revoked";
  customPermissions: Permission[];
  deniedPermissions: Permission[];
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
};

export type WorkspaceTeamData =
  | {
      source: "database";
      clientId: string;
      clientName: string;
      members: WorkspaceMemberSummary[];
      invitations: WorkspaceInvitationSummary[];
    }
  | {
      source: "unavailable";
      message: string;
      clientId: string;
      clientName: null;
      members: [];
      invitations: [];
    };

export async function getWorkspaceTeamData(
  access: ClientScopedAccess,
): Promise<WorkspaceTeamData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message: "The database is unavailable.",
      clientId: access.activeClientId,
      clientName: null,
      members: [],
      invitations: [],
    };
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
      },
    });

    if (!client) {
      return {
        source: "unavailable",
        message: "The selected workspace could not be found.",
        clientId: access.activeClientId,
        clientName: null,
        members: [],
        invitations: [],
      };
    }

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
    };
  } catch (error) {
    console.error(
      "[team-data] Workspace team query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      source: "unavailable",
      message: "Team data is temporarily unavailable.",
      clientId: access.activeClientId,
      clientName: null,
      members: [],
      invitations: [],
    };
  }
}