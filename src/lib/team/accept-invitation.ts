import type { User } from "@supabase/supabase-js";
import { normalizeEmail } from "@/lib/auth/registration-validation";
import { getPrisma } from "@/lib/db/prisma";
import {
  hashInvitationToken,
  isValidInvitationToken,
} from "@/lib/team/invitation-token";

export type AcceptInvitationOutcome =
  | {
      outcome: "accepted";
      clientId: string;
    }
  | {
      outcome: "already_accepted";
      clientId: string;
    }
  | {
      outcome:
        | "invalid"
        | "expired"
        | "revoked"
        | "email_mismatch"
        | "database_unavailable"
        | "error";
    };

export async function acceptWorkspaceInvitation(
  user: User,
  profileId: string,
  invitationToken: string,
): Promise<AcceptInvitationOutcome> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      outcome: "database_unavailable",
    };
  }

  if (
    !user.email ||
    !isValidInvitationToken(invitationToken)
  ) {
    return {
      outcome: "invalid",
    };
  }

  const verifiedEmail = normalizeEmail(user.email);
  const tokenHash = hashInvitationToken(invitationToken);

  try {
    return await prisma.$transaction(async (transaction) => {
      const invitation =
        await transaction.userInvitation.findUnique({
          where: {
            tokenHash,
          },
          select: {
            id: true,
            clientId: true,
            email: true,
            role: true,
            status: true,
            customPermissions: true,
            deniedPermissions: true,
            expiresAt: true,
          },
        });

      if (!invitation) {
        return {
          outcome: "invalid" as const,
        };
      }

      if (invitation.status === "accepted") {
        const membership =
          await transaction.clientMembership.findUnique({
            where: {
              profileId_clientId: {
                profileId,
                clientId: invitation.clientId,
              },
            },
            select: {
              id: true,
            },
          });

        if (membership) {
          return {
            outcome: "already_accepted" as const,
            clientId: invitation.clientId,
          };
        }

        return {
          outcome: "invalid" as const,
        };
      }

      if (invitation.status === "revoked") {
        return {
          outcome: "revoked" as const,
        };
      }

      if (
        invitation.status === "expired" ||
        invitation.expiresAt.getTime() <= Date.now()
      ) {
        if (invitation.status === "pending") {
          await transaction.userInvitation.update({
            where: {
              id: invitation.id,
            },
            data: {
              status: "expired",
            },
          });
        }

        return {
          outcome: "expired" as const,
        };
      }

      if (
        normalizeEmail(invitation.email) !== verifiedEmail
      ) {
        return {
          outcome: "email_mismatch" as const,
        };
      }

      const existingMembership =
        await transaction.clientMembership.findUnique({
          where: {
            profileId_clientId: {
              profileId,
              clientId: invitation.clientId,
            },
          },
          select: {
            id: true,
            role: true,
          },
        });

      if (!existingMembership) {
        await transaction.clientMembership.create({
          data: {
            profileId,
            clientId: invitation.clientId,
            role: invitation.role,
            status: "active",
            customPermissions:
              invitation.customPermissions,
            deniedPermissions:
              invitation.deniedPermissions,
          },
        });
      } else if (existingMembership.role !== "owner") {
        await transaction.clientMembership.update({
          where: {
            id: existingMembership.id,
          },
          data: {
            role: invitation.role,
            status: "active",
            customPermissions:
              invitation.customPermissions,
            deniedPermissions:
              invitation.deniedPermissions,
          },
        });
      }

      await transaction.userInvitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
          revokedAt: null,
        },
      });

      await transaction.auditLog.create({
        data: {
          profileId,
          clientId: invitation.clientId,
          action: "user_invitation_accepted",
          entityType: "UserInvitation",
          entityId: invitation.id,
          metadata: {
            note: `${verifiedEmail} accepted a workspace invitation.`,
          },
        },
      });

      return {
        outcome: "accepted" as const,
        clientId: invitation.clientId,
      };
    });
  } catch (error) {
    console.error(
      "[accept-invitation] Invitation acceptance failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      outcome: "error",
    };
  }
}