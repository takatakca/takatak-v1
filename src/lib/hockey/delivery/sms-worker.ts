import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { getIdentityHockeyFeatures } from "./entitlement";
import { buildHockeySms } from "./sms-message";
import { sendHockeySms } from "./twilio-sms";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;

type SmsJobKind = "sms_reminder" | "sms_event_change";

function isSmsJobKind(value: string): value is SmsJobKind {
  return value === "sms_reminder" || value === "sms_event_change";
}

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

export async function runHockeySmsDeliveryBatch(input?: {
  limit?: number;
  now?: Date;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("hockey_delivery_database_unavailable");
  }

  const now = input?.now ?? new Date();
  const limit = Math.min(Math.max(input?.limit ?? 25, 1), 50);

  const jobs = await prisma.hockeyDeliveryJob.findMany({
    where: {
      status: "queued",
      scheduledAt: { lte: now },
      kind: { in: ["sms_reminder", "sms_event_change"] },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      identityId: true,
      kind: true,
      eventRevision: true,
      attemptCount: true,
      teamEvent: {
        select: {
          id: true,
          sourceApplication: true,
          teamId: true,
          title: true,
          startsAt: true,
          timezone: true,
          arenaName: true,
          arenaAddress: true,
          status: true,
          sourceUrl: true,
          payloadHash: true,
        },
      },
      identity: {
        select: {
          primaryPhone: true,
          primaryPhoneVerified: true,
          locale: true,
        },
      },
    },
  });

  let completed = 0;
  let skipped = 0;
  let retried = 0;
  let failed = 0;

  for (const job of jobs) {
    if (!isSmsJobKind(job.kind)) continue;

    const claimed = await prisma.hockeyDeliveryJob.updateMany({
      where: { id: job.id, status: "queued" },
      data: {
        status: "processing",
        lockedAt: now,
        attemptCount: { increment: 1 },
      },
    });

    if (claimed.count !== 1) continue;

    const attempt = job.attemptCount + 1;
    const event = job.teamEvent;

    if (event.payloadHash !== job.eventRevision) {
      await skipJob(job.id, "superseded", "A newer official event revision exists.", now);
      skipped += 1;
      continue;
    }

    if (!job.identity.primaryPhone || !job.identity.primaryPhoneVerified) {
      await skipJob(job.id, "phone_unverified", "A verified phone is required for SMS reminders.", now);
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
        smsReminders: true,
        smsConsentAt: true,
      },
    });

    if (!preference?.smsReminders || !preference.smsConsentAt) {
      await skipJob(job.id, "sms_consent_disabled", "SMS reminders are not currently enabled.", now);
      skipped += 1;
      continue;
    }

    const features = await getIdentityHockeyFeatures(job.identityId, now);
    if (!features.has("game_reminders")) {
      await skipJob(job.id, "premium_required", "Current premium entitlement does not include game reminders.", now);
      skipped += 1;
      continue;
    }

    if (job.kind === "sms_reminder" && event.status === "cancelled") {
      await skipJob(job.id, "event_cancelled", "Cancelled events do not receive reminder SMS.", now);
      skipped += 1;
      continue;
    }

    try {
      const body = buildHockeySms({
        kind: job.kind,
        locale: job.identity.locale,
        event,
      });

      await sendHockeySms({
        to: job.identity.primaryPhone,
        body,
      });

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
        error instanceof Error ? error.message : "SMS delivery failed.";

      if (attempt < MAX_ATTEMPTS) {
        await prisma.hockeyDeliveryJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            scheduledAt: new Date(now.getTime() + RETRY_DELAY_MS),
            lockedAt: null,
            lastErrorCode: "sms_retry",
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
            lastErrorCode: "sms_failed",
            lastErrorMessage: errorMessage.slice(0, 500),
          },
        });
        failed += 1;
      }
    }
  }

  return {
    scanned: jobs.length,
    completed,
    skipped,
    retried,
    failed,
  };
}
