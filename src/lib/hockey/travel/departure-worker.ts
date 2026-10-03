import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { getIdentityHockeyFeatures } from "@/lib/hockey/delivery/entitlement";
import { sendHockeySms } from "@/lib/hockey/delivery/twilio-sms";
import { buildHockeyDepartureSms } from "./departure-message";
import {
  hockeyLeaveBy,
  nextHockeyDepartureCheck,
  shouldSendHockeyDepartureAlert,
} from "./departure-policy";
import {
  computeHockeyTrafficRoute,
  type HockeyRouteDestination,
} from "./google-routes";
import { loadHockeyTravelOriginForWorker } from "./travel-service";

const MAX_PROVIDER_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;

async function finishJob(
  jobId: string,
  status: "completed" | "skipped" | "failed",
  now: Date,
  code: string | null = null,
  message: string | null = null,
) {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.hockeyDeliveryJob.update({
    where: { id: jobId },
    data: {
      status,
      completedAt: now,
      lockedAt: null,
      lastErrorCode: code,
      lastErrorMessage: message?.slice(0, 500) ?? null,
    },
  });
}

export async function runHockeyDepartureDeliveryBatch(input?: {
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
      kind: "departure_alert",
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
          teamId: true,
          title: true,
          startsAt: true,
          timezone: true,
          arenaName: true,
          arenaAddress: true,
          arenaLatitude: true,
          arenaLongitude: true,
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
  let rescheduled = 0;
  let skipped = 0;
  let retried = 0;
  let failed = 0;

  for (const job of jobs) {
    const claimed = await prisma.hockeyDeliveryJob.updateMany({
      where: { id: job.id, status: "queued" },
      data: {
        status: "processing",
        lockedAt: now,
      },
    });
    if (claimed.count !== 1) continue;

    const event = job.teamEvent;
    const providerAttempt = job.attemptCount + 1;

    if (event.payloadHash !== job.eventRevision) {
      await finishJob(
        job.id,
        "skipped",
        now,
        "superseded",
        "A newer official event revision exists.",
      );
      skipped += 1;
      continue;
    }

    if (event.status === "cancelled" || event.startsAt.getTime() <= now.getTime()) {
      await finishJob(
        job.id,
        "skipped",
        now,
        "event_not_actionable",
        "Cancelled or already-started events do not receive departure alerts.",
      );
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
        departureAlerts: true,
        departureConsentAt: true,
        arrivalBufferMinutes: true,
        smsReminders: true,
        smsConsentAt: true,
      },
    });

    if (
      !preference?.departureAlerts ||
      !preference.departureConsentAt ||
      !preference.smsReminders ||
      !preference.smsConsentAt
    ) {
      await finishJob(
        job.id,
        "skipped",
        now,
        "departure_consent_disabled",
        "Smart-departure SMS consent is not currently enabled.",
      );
      skipped += 1;
      continue;
    }

    if (!job.identity.primaryPhone || !job.identity.primaryPhoneVerified) {
      await finishJob(
        job.id,
        "skipped",
        now,
        "phone_unverified",
        "A verified phone is required for departure SMS alerts.",
      );
      skipped += 1;
      continue;
    }

    const features = await getIdentityHockeyFeatures(job.identityId, now);
    if (!features.has("smart_departure")) {
      await finishJob(
        job.id,
        "skipped",
        now,
        "premium_required",
        "Current premium entitlement does not include smart departure.",
      );
      skipped += 1;
      continue;
    }

    const travel = await loadHockeyTravelOriginForWorker(job.identityId);
    if (!travel) {
      await finishJob(
        job.id,
        "skipped",
        now,
        "travel_origin_missing",
        "No parent-approved smart-departure origin is configured.",
      );
      skipped += 1;
      continue;
    }

    let destination: HockeyRouteDestination | null = null;
    if (
      event.arenaLatitude !== null &&
      event.arenaLongitude !== null
    ) {
      destination = {
        latitude: event.arenaLatitude,
        longitude: event.arenaLongitude,
      };
    } else if (event.arenaAddress?.trim()) {
      destination = { address: event.arenaAddress.trim() };
    }

    if (!destination) {
      await finishJob(
        job.id,
        "skipped",
        now,
        "arena_location_missing",
        "The official event does not contain a routeable arena location.",
      );
      skipped += 1;
      continue;
    }

    try {
      const route = await computeHockeyTrafficRoute({
        origin: travel.origin,
        destination,
      });

      await prisma.hockeyTravelProfile.update({
        where: { id: travel.profileId },
        data: { lastUsedAt: now },
      });

      const leaveBy = hockeyLeaveBy({
        startsAt: event.startsAt,
        arrivalBufferMinutes: preference.arrivalBufferMinutes,
        durationSeconds: route.durationSeconds,
      });

      if (
        !shouldSendHockeyDepartureAlert({
          now,
          leaveBy,
          alertWindowMinutes: 10,
        })
      ) {
        await prisma.hockeyDeliveryJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            scheduledAt: nextHockeyDepartureCheck({ now, leaveBy }),
            lockedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        rescheduled += 1;
        continue;
      }

      const body = buildHockeyDepartureSms({
        locale: job.identity.locale,
        title: event.title,
        timezone: event.timezone,
        leaveBy,
        durationSeconds: route.durationSeconds,
        trafficDelaySeconds: route.trafficDelaySeconds,
        arenaName: event.arenaName,
        sourceUrl: event.sourceUrl,
      });

      await sendHockeySms({
        to: job.identity.primaryPhone,
        body,
      });

      await finishJob(job.id, "completed", now);
      completed += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Smart-departure calculation failed.";

      if (providerAttempt < MAX_PROVIDER_ATTEMPTS) {
        await prisma.hockeyDeliveryJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            scheduledAt: new Date(now.getTime() + RETRY_DELAY_MS),
            lockedAt: null,
            attemptCount: { increment: 1 },
            lastErrorCode: "departure_retry",
            lastErrorMessage: errorMessage.slice(0, 500),
          },
        });
        retried += 1;
      } else {
        await finishJob(
          job.id,
          "failed",
          now,
          "departure_failed",
          errorMessage,
        );
        failed += 1;
      }
    }
  }

  return {
    scanned: jobs.length,
    completed,
    rescheduled,
    skipped,
    retried,
    failed,
  };
}
