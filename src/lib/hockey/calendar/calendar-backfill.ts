import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { deliveryDedupeKey } from "@/lib/hockey/events/policy";

export async function queueHockeyCalendarBackfill(
  identityId: string,
  now = new Date(),
): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;

  const preferences = await prisma.hockeyParentTeamPreference.findMany({
    where: {
      identityId,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      calendarSync: true,
      calendarConsentAt: { not: null },
    },
    select: { teamId: true },
  });

  const teamIds = [...new Set(preferences.map((item) => item.teamId))];
  if (teamIds.length === 0) return 0;

  const events = await prisma.hockeyTeamEvent.findMany({
    where: {
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      teamId: { in: teamIds },
      startsAt: { gte: now },
      status: { not: "cancelled" },
    },
    orderBy: { startsAt: "asc" },
    take: 500,
    select: {
      id: true,
      payloadHash: true,
    },
  });

  if (events.length === 0) return 0;

  const result = await prisma.hockeyDeliveryJob.createMany({
    data: events.map((event) => ({
      identityId,
      teamEventId: event.id,
      kind: "calendar_sync",
      status: "queued",
      scheduledAt: now,
      eventRevision: event.payloadHash,
      dedupeKey: deliveryDedupeKey({
        identityId,
        teamEventId: event.id,
        kind: "calendar_sync",
        eventRevision: event.payloadHash,
      }),
    })),
    skipDuplicates: true,
  });

  return result.count;
}
