import {
  HOCKEY_TEAM_EVENT_STATUSES,
  HOCKEY_TEAM_EVENT_TYPES,
  type AhmvTeamEventEnvelope,
  type HockeyTeamEventStatus,
  type HockeyTeamEventType,
} from "./types";

const TEAM_ID_RE = /^[A-Za-z0-9._:-]+$/;
const SAFE_TIMEZONE_RE = /^[A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)?$/;

function text(
  value: unknown,
  max: number,
  required = false,
): string | null {
  if (value === null || value === undefined) return required ? null : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return required ? null : null;
  return trimmed.slice(0, max);
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}

function httpsUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function coordinate(
  value: unknown,
  min: number,
  max: number,
): number | null | "invalid" {
  if (value === null || value === undefined) return null;
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : "invalid";
}

export function parseAhmvTeamEventEnvelope(rawBody: string):
  | { valid: true; envelope: AhmvTeamEventEnvelope }
  | { valid: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return { valid: false, error: "Payload must be valid JSON." };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "Payload must be a JSON object." };
  }

  const body = value as Record<string, unknown>;
  const eventId = text(body.eventId, 160, true);
  const occurredAt = dateValue(body.occurredAt);

  if (!eventId || !occurredAt || body.type !== "hockey.team_event.upsert") {
    return { valid: false, error: "Invalid hockey event envelope." };
  }

  if (!body.event || typeof body.event !== "object" || Array.isArray(body.event)) {
    return { valid: false, error: "A normalized team event is required." };
  }

  const event = body.event as Record<string, unknown>;
  const sourceEventId = text(event.sourceEventId, 180, true);
  const teamId = text(event.teamId, 160, true);
  const title = text(event.title, 240, true);
  const startsAt = dateValue(event.startsAt);
  const endsAt =
    event.endsAt === null || event.endsAt === undefined
      ? null
      : dateValue(event.endsAt);
  const sourceUpdatedAt = dateValue(event.sourceUpdatedAt);
  const timezone = text(event.timezone, 80, true);
  const eventType = event.eventType;
  const status = event.status;
  const arenaName = text(event.arenaName, 180);
  const arenaAddress = text(event.arenaAddress, 320);
  const arenaLatitude = coordinate(event.arenaLatitude, -90, 90);
  const arenaLongitude = coordinate(event.arenaLongitude, -180, 180);
  const sourceUrl =
    event.sourceUrl === null || event.sourceUrl === undefined
      ? null
      : httpsUrl(event.sourceUrl);

  if (!sourceEventId || !teamId || !TEAM_ID_RE.test(teamId) || !title) {
    return { valid: false, error: "Event identity, team and title are invalid." };
  }
  if (
    !HOCKEY_TEAM_EVENT_TYPES.includes(eventType as HockeyTeamEventType) ||
    !HOCKEY_TEAM_EVENT_STATUSES.includes(status as HockeyTeamEventStatus)
  ) {
    return { valid: false, error: "Event type or status is invalid." };
  }
  if (
    !startsAt ||
    !sourceUpdatedAt ||
    !timezone ||
    !SAFE_TIMEZONE_RE.test(timezone) ||
    (event.endsAt !== null && event.endsAt !== undefined && !endsAt)
  ) {
    return { valid: false, error: "Event timing is invalid." };
  }
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { valid: false, error: "Event end time must be after start time." };
  }
  if (arenaLatitude === "invalid" || arenaLongitude === "invalid") {
    return { valid: false, error: "Arena coordinates are invalid." };
  }
  if (
    event.sourceUrl !== null &&
    event.sourceUrl !== undefined &&
    !sourceUrl
  ) {
    return { valid: false, error: "Source URL must use HTTPS." };
  }

  return {
    valid: true,
    envelope: {
      eventId,
      type: "hockey.team_event.upsert",
      occurredAt,
      event: {
        sourceEventId,
        teamId,
        eventType: eventType as HockeyTeamEventType,
        title,
        startsAt,
        endsAt,
        timezone,
        arenaName,
        arenaAddress,
        arenaLatitude,
        arenaLongitude,
        status: status as HockeyTeamEventStatus,
        sourceUrl,
        sourceUpdatedAt,
      },
    },
  };
}
