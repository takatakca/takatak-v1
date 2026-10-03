import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { getIdentityHockeyFeatures } from "@/lib/hockey/delivery/entitlement";
import {
  GoogleCalendarNotFoundError,
  GoogleCalendarUnauthorizedError,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "./google-calendar-api";
import { getHockeyGoogleCalendarCredential } from "./google-credential";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;

async function skipJob(
  jobId: string,
  code: string,
  message: string,
  now: Date,
) {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.hockeyDeliveryJob.update({
    where: { id: jobId },
    data: {
      status: "skipped",
      completedAt: now,
      lockedAt: null,
      lastErrorCode: code.slice(0, 80),
      lastErrorMessage: message.slice(0, 500),
    },
  });
}

function calendarEventInput(event: {
  id: string;
  sourceEventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  arenaName: string | null;
  arenaAddress: string | null;
  sourceUrl: string | null;
  payloadHash: string;
}) {
  const endsAt =
    event.endsAt ?? new Date(event.startsAt.getTime() + 90 * 60 * 1000);
  const location = event.arenaAddress || event.arenaName || null;
  const description = event.sourceUrl
    ? `AHM Verdun — information d'équipe synchronisée par TAKATAK. Source officielle : ${event.sourceUrl}`
    : "AHM Verdun — information d'équipe synchronisée par TAKATAK. Vérifiez la source officielle en cas de changement.";

  return {
    summary: event.title,
    description,
    location,
    startsAt: event.startsAt,
    endsAt,
    timezone: event.timezone,
    teamEventId: event.id,
    sourceEventId: event.sourceEventId,
    revision: event.payloadHash,
  };
}

async function performWithCredentialRefresh<T>(input: {
  identityId: string;
  action: (credential: {
    connectionId: string;
    calendarId: string;
    accessToken: string;
  }) => Promise<T>;
}): Promise<T> {
  let credential = await getHockeyGoogleCalendarCredential({
    identityId: input.identityId,
  });

  try {
    return await input.action(credential);
  } catch (error) {
    if (!(error instanceof GoogleCalendarUnauthorizedError)) throw error;
    credential = await getHockeyGoogleCalendarCredential({
      identityId: input.identityId,
      forceRefresh: true,
    });
    return input.action(credential);
  }
}

export async function runHockeyCalendarDeliveryBatch(input?: {
  limit?: number;
  now?: Date;
}) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("hockey_delivery_database_unavailable");

  const now = input?.now ?? new Date();
  const limit = Math.min(Math.max(input?.limit ?? 20, 1), 50);

  const jobs = await prisma.hockeyDeliveryJob.findMany({
    where: {
      status: "queued",
      scheduledAt: { lte: now },
      kind: "calendar_sync",
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      identityId: true,
      eventRevision: true,
      attemptCount: true,
      teamEvent: {
        select: {
          id: true,
          sourceEventId: true,
          teamId: true,
          title: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          arenaName: true,
          arenaAddress: true,
          status: true,
          sourceUrl: true,
          payloadHash: true,
        },
      },
    },
  });

  let completed = 0;
  let skipped = 0;
  let retried = 0;
  let failed = 0;

  for (const job of jobs) {
    const claimed = await prisma.hockeyDeliveryJob.updateMany({
      where: { id: job.id, status: "queued" },
      data: {
        status: "processing",
        lockedAt: now,
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) continue;

    const event = job.teamEvent;
    const attempt = job.attemptCount + 1;

    if (event.payloadHash !== job.eventRevision) {
      await skipJob(job.id, "superseded", "A newer official event revision exists.", now);
      skipped += 1;
      continue;
    }

    const preference = await prisma.hockeyParentTeamPreference.findUnique({
      where: {
        identityId_sourceApplication_teamId: {
          identityId: job.identityId,
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          teamId: event.teamId,
        },
      },
      select: {
        calendarSync: true,
        calendarConsentAt: true,
      },
    });

    if (!preference?.calendarSync || !preference.calendarConsentAt) {
      await skipJob(job.id, "calendar_consent_disabled", "Calendar sync is not currently enabled.", now);
      skipped += 1;
      continue;
    }

    const features = await getIdentityHockeyFeatures(job.identityId, now);
    if (!features.has("calendar_sync")) {
      await skipJob(job.id, "premium_required", "Current premium entitlement does not include calendar sync.", now);
      skipped += 1;
      continue;
    }

    try {
      const credential = await getHockeyGoogleCalendarCredential({
        identityId: job.identityId,
      });

      const mapping = await prisma.hockeyCalendarEventMapping.findUnique({
        where: {
          connectionId_teamEventId: {
            connectionId: credential.connectionId,
            teamEventId: event.id,
          },
        },
        select: {
          id: true,
          providerEventId: true,
          status: true,
        },
      });

      if (event.status === "cancelled") {
        if (mapping && mapping.status === "active") {
          await performWithCredentialRefresh({
            identityId: job.identityId,
            action: (current) =>
              deleteGoogleCalendarEvent({
                accessToken: current.accessToken,
                calendarId: current.calendarId,
                providerEventId: mapping.providerEventId,
              }),
          });
          await prisma.hockeyCalendarEventMapping.update({
            where: { id: mapping.id },
            data: {
              status: "deleted",
              eventRevision: event.payloadHash,
              lastSyncedAt: now,
            },
          });
        }

        await prisma.hockeyDeliveryJob.update({
          where: { id: job.id },
          data: {
            status: "completed",
            completedAt: now,
            lockedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        completed += 1;
        continue;
      }

      const calendarEvent = calendarEventInput(event);

      if (mapping && mapping.status === "active") {
        try {
          await performWithCredentialRefresh({
            identityId: job.identityId,
            action: (current) =>
              updateGoogleCalendarEvent({
                accessToken: current.accessToken,
                calendarId: current.calendarId,
                providerEventId: mapping.providerEventId,
                event: calendarEvent,
              }),
          });

          await prisma.hockeyCalendarEventMapping.update({
            where: { id: mapping.id },
            data: {
              eventRevision: event.payloadHash,
              lastSyncedAt: now,
              status: "active",
            },
          });
        } catch (error) {
          if (!(error instanceof GoogleCalendarNotFoundError)) throw error;

          const providerEventId = await performWithCredentialRefresh({
            identityId: job.identityId,
            action: (current) =>
              createGoogleCalendarEvent({
                accessToken: current.accessToken,
                calendarId: current.calendarId,
                event: calendarEvent,
              }),
          });

          await prisma.hockeyCalendarEventMapping.update({
            where: { id: mapping.id },
            data: {
              providerEventId,
              eventRevision: event.payloadHash,
              lastSyncedAt: now,
              status: "active",
            },
          });
        }
      } else {
        const providerEventId = await performWithCredentialRefresh({
          identityId: job.identityId,
          action: (current) =>
            createGoogleCalendarEvent({
              accessToken: current.accessToken,
              calendarId: current.calendarId,
              event: calendarEvent,
            }),
        });

        await prisma.hockeyCalendarEventMapping.upsert({
          where: {
            connectionId_teamEventId: {
              connectionId: credential.connectionId,
              teamEventId: event.id,
            },
          },
          update: {
            providerEventId,
            eventRevision: event.payloadHash,
            lastSyncedAt: now,
            status: "active",
          },
          create: {
            connectionId: credential.connectionId,
            teamEventId: event.id,
            providerEventId,
            eventRevision: event.payloadHash,
            lastSyncedAt: now,
            status: "active",
          },
        });
      }

      await prisma.hockeyDeliveryJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          completedAt: now,
          lockedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      completed += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Calendar sync failed.";

      if (attempt < MAX_ATTEMPTS) {
        await prisma.hockeyDeliveryJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            scheduledAt: new Date(now.getTime() + RETRY_DELAY_MS),
            lockedAt: null,
            lastErrorCode: "calendar_retry",
            lastErrorMessage: errorMessage.slice(0, 500),
          },
        });
        retried += 1;
      } else {
        await prisma.hockeyDeliveryJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            completedAt: now,
            lockedAt: null,
            lastErrorCode: "calendar_failed",
            lastErrorMessage: errorMessage.slice(0, 500),
          },
        });
        failed += 1;
      }
    }
  }

  return { scanned: jobs.length, completed, skipped, retried, failed };
}
