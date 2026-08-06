import { getPrisma } from "@/lib/db/prisma";
import type { AdminAccessResult } from "@/lib/security/guard";

export interface ClientListItem {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  planName: string | null;
  timezone: string;
  status: string;
  assignedAdminName: string | null;
  assignedAdminEmail: string | null;
  ownerNames: string[];
  brandCount: number;
  locationCount: number;
  memberCount: number;
  createdAt: string;
}

export interface ClientDetail {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  planName: string | null;
  timezone: string;
  status: string;
  assignedAdminEmail: string | null;
  owners: Array<{
    id: string;
    displayName: string;
    email: string;
    status: string;
  }>;
  brandCount: number;
  locationCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ClientDirectoryData =
  | {
      source: "database";
      clients: ClientListItem[];
    }
  | {
      source: "unavailable";
      message: string;
      clients: [];
    };

export type ClientDetailData =
  | {
      source: "database";
      client: ClientDetail;
    }
  | {
      source: "not_found";
      client: null;
    }
  | {
      source: "unavailable";
      message: string;
      client: null;
    };

function displayProfileName(profile: {
  displayName: string | null;
  email: string;
}): string {
  return profile.displayName ?? profile.email;
}

export async function getClientDirectoryData(
  access: AdminAccessResult,
): Promise<ClientDirectoryData> {
  if (!access.enforced) {
    return {
      source: "unavailable",
      message:
        "Configure authentication and a database to manage real workspaces.",
      clients: [],
    };
  }

  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message:
        "The workspace database is unavailable.",
      clients: [],
    };
  }

  try {
    const clients = await prisma.client.findMany({
      orderBy: [
        {
          status: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        planName: true,
        timezone: true,
        status: true,
        createdAt: true,
        assignedProfile: {
          select: {
            displayName: true,
            email: true,
          },
        },
        memberships: {
          where: {
            role: "owner",
            status: "active",
          },
          select: {
            profile: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        businessBrands: {
          select: {
            _count: {
              select: {
                businessLocations: true,
              },
            },
          },
        },
        _count: {
          select: {
            businessBrands: true,
            memberships: true,
          },
        },
      },
    });

    return {
      source: "database",
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        companyName: client.companyName,
        email: client.email,
        phone: client.phone,
        planName: client.planName,
        timezone: client.timezone,
        status: client.status,
        assignedAdminName: client.assignedProfile
          ? displayProfileName(client.assignedProfile)
          : null,
        assignedAdminEmail:
          client.assignedProfile?.email ?? null,
        ownerNames: client.memberships.map(
          (membership) =>
            displayProfileName(membership.profile),
        ),
        brandCount: client._count.businessBrands,
        locationCount:
          client.businessBrands.reduce(
            (total, brand) =>
              total +
              brand._count.businessLocations,
            0,
          ),
        memberCount: client._count.memberships,
        createdAt: client.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error(
      "[client-data] Client directory query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      source: "unavailable",
      message:
        "Workspace data is temporarily unavailable.",
      clients: [],
    };
  }
}

export async function getClientDetailData(
  access: AdminAccessResult,
  clientId: string,
): Promise<ClientDetailData> {
  if (!access.enforced) {
    return {
      source: "unavailable",
      message:
        "Configure authentication and a database to manage real workspaces.",
      client: null,
    };
  }

  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message:
        "The workspace database is unavailable.",
      client: null,
    };
  }

  try {
    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        planName: true,
        timezone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        assignedProfile: {
          select: {
            email: true,
          },
        },
        memberships: {
          where: {
            role: "owner",
          },
          select: {
            id: true,
            status: true,
            profile: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        businessBrands: {
          select: {
            _count: {
              select: {
                businessLocations: true,
              },
            },
          },
        },
        _count: {
          select: {
            businessBrands: true,
            memberships: true,
          },
        },
      },
    });

    if (!client) {
      return {
        source: "not_found",
        client: null,
      };
    }

    return {
      source: "database",
      client: {
        id: client.id,
        name: client.name,
        companyName: client.companyName,
        email: client.email,
        phone: client.phone,
        planName: client.planName,
        timezone: client.timezone,
        status: client.status,
        assignedAdminEmail:
          client.assignedProfile?.email ?? null,
        owners: client.memberships.map(
          (membership) => ({
            id: membership.id,
            displayName:
              membership.profile.displayName ??
              membership.profile.email,
            email: membership.profile.email,
            status: membership.status,
          }),
        ),
        brandCount: client._count.businessBrands,
        locationCount:
          client.businessBrands.reduce(
            (total, brand) =>
              total +
              brand._count.businessLocations,
            0,
          ),
        memberCount: client._count.memberships,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error(
      "[client-data] Client detail query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      source: "unavailable",
      message:
        "Workspace data is temporarily unavailable.",
      client: null,
    };
  }
}