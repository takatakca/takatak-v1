// Workspace notification center: what the active workspace (and the signed-in
// person, for notifications not tied to a workspace) can see and mark read.

import type { NotificationStatus, NotificationType, Prisma } from "@prisma/client";

export const NOTIFICATION_PAGE_SIZE = 50;
export const MAX_MARK_READ_IDS = 100;

export interface NotificationsDb {
  notification: Pick<Prisma.TransactionClient["notification"], "findMany" | "count" | "updateMany">;
}

export interface WorkspaceNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  createdAt: Date;
  href: string | null;
}

/** Visible to a member: this workspace's notifications, plus personal ones without a workspace. */
export function visibleTo(clientId: string, profileId: string | null): Prisma.NotificationWhereInput {
  const scopes: Prisma.NotificationWhereInput[] = [{ clientId }];
  if (profileId) scopes.push({ clientId: null, profileId });
  return { OR: scopes };
}

const ENTITY_LINKS: Record<string, string> = {
  lead: "/dashboard/leads/inbox",
  content_contribution: "/dashboard/contributions",
};

export function linkFor(relatedEntityType: string | null): string | null {
  return relatedEntityType ? ENTITY_LINKS[relatedEntityType] ?? null : null;
}

export async function listWorkspaceNotifications(
  db: NotificationsDb,
  clientId: string,
  profileId: string | null,
): Promise<{ notifications: WorkspaceNotification[]; unread: number }> {
  const where = { ...visibleTo(clientId, profileId), status: { not: "archived" as const } };
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        status: true,
        createdAt: true,
        relatedEntityType: true,
      },
    }),
    db.notification.count({ where: { ...visibleTo(clientId, profileId), status: "unread" } }),
  ]);
  return {
    unread,
    notifications: rows.map(({ relatedEntityType, ...row }) => ({ ...row, href: linkFor(relatedEntityType) })),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses `{ all: true }` or `{ ids: [...] }`; null when invalid. */
export function parseMarkReadBody(body: unknown): { all: true } | { ids: string[] } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  if (value.all === true) return { all: true };
  if (!Array.isArray(value.ids) || value.ids.length === 0 || value.ids.length > MAX_MARK_READ_IDS) return null;
  if (!value.ids.every((id) => typeof id === "string" && UUID_RE.test(id))) return null;
  return { ids: [...new Set(value.ids as string[])] };
}

export async function markNotificationsRead(
  db: NotificationsDb,
  input: { clientId: string; profileId: string | null; target: { all: true } | { ids: string[] }; now?: Date },
): Promise<number> {
  const where: Prisma.NotificationWhereInput = {
    ...visibleTo(input.clientId, input.profileId),
    status: "unread",
    ...("ids" in input.target ? { id: { in: input.target.ids } } : {}),
  };
  const result = await db.notification.updateMany({
    where,
    data: { status: "read", readAt: input.now ?? new Date() },
  });
  return result.count;
}
