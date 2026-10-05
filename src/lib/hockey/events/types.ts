export const HOCKEY_TEAM_EVENT_TYPES = [
  "game",
  "practice",
  "tournament",
  "tryout",
  "event",
  "other",
] as const;

export const HOCKEY_TEAM_EVENT_STATUSES = [
  "confirmed",
  "modified",
  "cancelled",
] as const;

export type HockeyTeamEventType = (typeof HOCKEY_TEAM_EVENT_TYPES)[number];
export type HockeyTeamEventStatus = (typeof HOCKEY_TEAM_EVENT_STATUSES)[number];

export type AhmvTeamEventInput = {
  sourceEventId: string;
  teamId: string;
  eventType: HockeyTeamEventType;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  arenaName: string | null;
  arenaAddress: string | null;
  arenaLatitude: number | null;
  arenaLongitude: number | null;
  status: HockeyTeamEventStatus;
  sourceUrl: string | null;
  sourceUpdatedAt: Date;
};

export type AhmvTeamEventEnvelope = {
  eventId: string;
  type: "hockey.team_event.upsert";
  occurredAt: Date;
  event: AhmvTeamEventInput;
};
