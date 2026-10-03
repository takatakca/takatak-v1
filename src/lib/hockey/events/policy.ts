import { createHash } from "node:crypto";

import type { AhmvTeamEventInput } from "./types";

export const DEFAULT_SMS_REMINDER_MINUTES = 120;
export const DEFAULT_DEPARTURE_CHECK_MINUTES = 120;

export function hockeyEventPayloadHash(event: AhmvTeamEventInput): string {
  const payload = JSON.stringify({
    sourceEventId: event.sourceEventId,
    teamId: event.teamId,
    eventType: event.eventType,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    timezone: event.timezone,
    arenaName: event.arenaName,
    arenaAddress: event.arenaAddress,
    arenaLatitude: event.arenaLatitude,
    arenaLongitude: event.arenaLongitude,
    status: event.status,
    sourceUrl: event.sourceUrl,
    sourceUpdatedAt: event.sourceUpdatedAt.toISOString(),
  });

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function scheduleBefore(
  startsAt: Date,
  leadMinutes: number,
  now = new Date(),
): Date {
  const target = new Date(startsAt.getTime() - leadMinutes * 60_000);
  return target.getTime() > now.getTime() ? target : now;
}

export function deliveryDedupeKey(input: {
  identityId: string;
  teamEventId: string;
  kind: string;
  eventRevision: string;
}): string {
  return createHash("sha256")
    .update(
      [
        "ahmv-delivery",
        input.identityId,
        input.teamEventId,
        input.kind,
        input.eventRevision,
      ].join(":"),
      "utf8",
    )
    .digest("hex");
}
