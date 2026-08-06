import { getPrisma } from "@/lib/db/prisma";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

export type WorkspaceActivityEntry = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorName: string;
  note: string | null;
  createdAt: string;
};

export type WorkspaceActivityData =
  | {
      source: "database";
      clientId: string;
      clientName: string;
      entries: WorkspaceActivityEntry[];
    }
  | {
      source: "unavailable";
      message: string;
      clientId: string;
      clientName: null;
      entries: [];
    };

function getSafeNote(metadata: unknown): string | null {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return null;
  }

  const note = (
    metadata as Record<string, unknown>
  ).note;

  if (typeof note !== "string") {
    return null;
  }

  const normalizedNote = note.trim();

  return normalizedNote || null;
}

export async function getWorkspaceActivityData(
  access: ClientScopedAccess,
): Promise<WorkspaceActivityData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message: "The database is unavailable.",
      clientId: access.activeClientId,
      clientName: null,
      entries: [],
    };
  }

  try {
    const [client, auditLogs] = await Promise.all([
      prisma.client.findUnique({
        where: {
          id: access.activeClientId,
        },
        select: {
          id: true,
          name: true,
        },
      }),

      prisma.auditLog.findMany({
        where: {
          clientId: access.activeClientId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
          profile: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    if (!client) {
      return {
        source: "unavailable",
        message:
          "The selected workspace could not be found.",
        clientId: access.activeClientId,
        clientName: null,
        entries: [],
      };
    }

    return {
      source: "database",
      clientId: client.id,
      clientName: client.name,
      entries: auditLogs.map((auditLog) => ({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        actorName:
          auditLog.profile?.displayName ??
          auditLog.profile?.email ??
          "System",
        note: getSafeNote(auditLog.metadata),
        createdAt:
          auditLog.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error(
      "[activity-data] Workspace activity query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      source: "unavailable",
      message:
        "Workspace activity is temporarily unavailable.",
      clientId: access.activeClientId,
      clientName: null,
      entries: [],
    };
  }
}