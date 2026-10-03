import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import {
  DEFAULT_DEPARTURE_CHECK_MINUTES,
  DEFAULT_SMS_REMINDER_MINUTES,
  deliveryDedupeKey,
  hockeyEventPayloadHash,
  scheduleBefore,
} from "./policy";
import type { AhmvTeamEventEnvelope } from "./types";

type DeliveryKind =
  | "calendar_sync"
  | "sms_reminder"
  | "sms_event_change"
  | "departure_alert";

export async function applyAhmvTeamEvent(
  envelope: AhmvTeamEventEnvelope,
  now = new Date(),
) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("hockey_event_database_unavailable");
  }

  const incoming = envelope.event;
  const payloadHash = hockeyEventPayloadHash(incoming);

  const existing = await prisma.hockeyTeamEvent.findUnique({
    where: {
      sourceApplication_sourceEventId: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        sourceEventId: incoming.sourceEventId,
      },
    },
    select: {
      id: true,
      payloadHash: true,
      sourceUpdatedAt: true,
    },
  });

  if (
    existing &&
    existing.sourceUpdatedAt.getTime() > incoming.sourceUpdatedAt.getTime()
  ) {
    return {
      applied: false as const,
      stale: true as const,
      duplicate: false as const,
      deliveryJobsCreated: 0,
    };
  }

  if (existing && existing.payloadHash === payloadHash) {
    return {
      applied: false as const,
      stale: false as const,
      duplicate: true as const,
      deliveryJobsCreated: 0,
    };
  }

  return prisma.$transaction(async (tx) => {
    const teamEvent = await tx.hockeyTeamEvent.upsert({
      where: {
        sourceApplication_sourceEventId: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          sourceEventId: incoming.sourceEventId,
        },
      },
      update: {
        teamId: incoming.teamId,
        eventType: incoming.eventType,
        title: incoming.title,
        startsAt: incoming.startsAt,
        endsAt: incoming.endsAt,
        timezone: incoming.timezone,
        arenaName: incoming.arenaName,
        arenaAddress: incoming.arenaAddress,
        arenaLatitude: incoming.arenaLatitude,
        arenaLongitude: incoming.arenaLongitude,
        status: incoming.status,
        sourceUrl: incoming.sourceUrl,
        sourceUpdatedAt: incoming.sourceUpdatedAt,
        payloadHash,
      },
      create: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        sourceEventId: incoming.sourceEventId,
        teamId: incoming.teamId,
        eventType: incoming.eventType,
        title: incoming.title,
        startsAt: incoming.startsAt,
        endsAt: incoming.endsAt,
        timezone: incoming.timezone,
        arenaName: incoming.arenaName,
        arenaAddress: incoming.arenaAddress,
        arenaLatitude: incoming.arenaLatitude,
        arenaLongitude: incoming.arenaLongitude,
        status: incoming.status,
        sourceUrl: incoming.sourceUrl,
        sourceUpdatedAt: incoming.sourceUpdatedAt,
        payloadHash,
      },
      select: { id: true },
    });

    await tx.hockeyDeliveryJob.updateMany({
      where: {
        teamEventId: teamEvent.id,
        status: "queued",
        eventRevision: { not: payloadHash },
      },
      data: {
        status: "skipped",
        completedAt: now,
        lastErrorCode: "superseded",
        lastErrorMessage: "A newer official event revision replaced this job.",
      },
    });

    const preferences = await tx.hockeyParentTeamPreference.findMany({
      where: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        teamId: incoming.teamId,
        OR: [
          { calendarSync: true },
          { smsReminders: true },
          { departureAlerts: true },
        ],
      },
      select: {
        identityId: true,
        calendarSync: true,
        smsReminders: true,
        departureAlerts: true,
      },
    });

    const changedExisting = Boolean(existing && existing.payloadHash !== payloadHash);
    const future = incoming.startsAt.getTime() > now.getTime();
    const hasArena =
      Boolean(incoming.arenaAddress) ||
      (incoming.arenaLatitude !== null && incoming.arenaLongitude !== null);

    const jobs: Array<{
      identityId: string;
      teamEventId: string;
      kind: DeliveryKind;
      status: string;
      scheduledAt: Date;
      dedupeKey: string;
      eventRevision: string;
    }> = [];

    function addJob(identityId: string, kind: DeliveryKind, scheduledAt: Date) {
      jobs.push({
        identityId,
        teamEventId: teamEvent.id,
        kind,
        status: "queued",
        scheduledAt,
        eventRevision: payloadHash,
        dedupeKey: deliveryDedupeKey({
          identityId,
          teamEventId: teamEvent.id,
          kind,
          eventRevision: payloadHash,
        }),
      });
    }

    for (const preference of preferences) {
      if (preference.calendarSync) {
        addJob(preference.identityId, "calendar_sync", now);
      }

      if (
        preference.smsReminders &&
        future &&
        incoming.status !== "cancelled"
      ) {
        addJob(
          preference.identityId,
          "sms_reminder",
          scheduleBefore(
            incoming.startsAt,
            DEFAULT_SMS_REMINDER_MINUTES,
            now,
          ),
        );
      }

      if (
        preference.smsReminders &&
        (changedExisting || incoming.status === "cancelled")
      ) {
        addJob(preference.identityId, "sms_event_change", now);
      }

      if (
        preference.departureAlerts &&
        future &&
        incoming.status !== "cancelled" &&
        hasArena
      ) {
        addJob(
          preference.identityId,
          "departure_alert",
          scheduleBefore(
            incoming.startsAt,
            DEFAULT_DEPARTURE_CHECK_MINUTES,
            now,
          ),
        );
      }
    }

    const result =
      jobs.length > 0
        ? await tx.hockeyDeliveryJob.createMany({
            data: jobs,
            skipDuplicates: true,
          })
        : { count: 0 };

    return {
      applied: true as const,
      stale: false as const,
      duplicate: false as const,
      teamEventId: teamEvent.id,
      payloadHash,
      deliveryJobsCreated: result.count,
    };
  });
}
