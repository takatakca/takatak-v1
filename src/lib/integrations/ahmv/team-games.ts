import type { AhmvScheduleEvent } from "./schedule-contract";

export type AhmvPublicTeamGame = {
  id: string;
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  venueAddress?: string;
  status: "scheduled" | "final" | "cancelled";
  officialUrl?: string;
  scoresheetUrl?: string;
};

function toPublicGame(event: AhmvScheduleEvent): AhmvPublicTeamGame | undefined {
  if (!event.homeTeam || !event.awayTeam) return undefined;

  if (
    event.status === "final" &&
    (event.homeScore === undefined || event.awayScore === undefined)
  ) {
    return undefined;
  }

  return {
    id: event.id,
    startsAt: event.startsAt,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    ...(event.homeScore !== undefined ? { homeScore: event.homeScore } : {}),
    ...(event.awayScore !== undefined ? { awayScore: event.awayScore } : {}),
    ...(event.venue ? { venue: event.venue } : {}),
    ...(event.venueAddress ? { venueAddress: event.venueAddress } : {}),
    status: event.status,
    ...(event.officialUrl ? { officialUrl: event.officialUrl } : {}),
    ...(event.scoresheetUrl ? { scoresheetUrl: event.scoresheetUrl } : {}),
  };
}

export function buildAhmvTeamGames(
  events: readonly AhmvScheduleEvent[],
  now = new Date(),
) {
  const nowMs = now.getTime();

  const scheduled = events
    .filter((event) => event.status === "scheduled" && Date.parse(event.startsAt) >= nowMs)
    .map(toPublicGame)
    .filter((game): game is AhmvPublicTeamGame => Boolean(game))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));

  const results = events
    .filter((event) => event.status === "final" && Date.parse(event.startsAt) <= nowMs)
    .map(toPublicGame)
    .filter((game): game is AhmvPublicTeamGame => Boolean(game))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt) || b.id.localeCompare(a.id));

  return {
    nextGame: scheduled[0],
    latestResult: results[0],
    recentResults: results.slice(0, 8),
  };
}
