import { getPrisma } from "@/lib/db/prisma";
import type { AdminUserSummary } from "@/lib/admin/types";

export type AdminUsersData =
  | {
      source: "database";
      sourceLabel: string;
      users: AdminUserSummary[];
    }
  | {
      source: "unavailable";
      sourceLabel: string;
      users: [];
    };

export async function getAdminUsersData(): Promise<AdminUsersData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      sourceLabel: "The database is unavailable.",
      users: [],
    };
  }

  try {
    const profiles = await prisma.profile.findMany({
      select: {
        id: true,
        authUserId: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
        memberships: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            clientId: true,
            role: true,
            status: true,
            client: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          createdAt: "asc",
        },
        {
          email: "asc",
        },
      ],
    });

    return {
      source: "database",
      sourceLabel: "Live database records",
      users: profiles.map((profile) => ({
        id: profile.id,
        authUserId: profile.authUserId,
        displayName: profile.displayName,
        email: profile.email,
        platformRole: profile.role,
        profileStatus: profile.status,
        memberships: profile.memberships.map(
          (membership) => ({
            id: membership.id,
            clientId: membership.clientId,
            clientName: membership.client.name,
            role: membership.role,
            status: membership.status,
          }),
        ),
        workspaceCount:
          profile.memberships.length,
        ownerWorkspaceCount:
          profile.memberships.filter(
            (membership) =>
              membership.role === "owner",
          ).length,
        createdAt:
          profile.createdAt
            .toISOString()
            .slice(0, 10),
      })),
    };
  } catch (error) {
    console.error(
      "[admin-users-data] User directory query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      source: "unavailable",
      sourceLabel:
        "Platform users are temporarily unavailable.",
      users: [],
    };
  }
}