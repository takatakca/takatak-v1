export type AhmvPublicTeamRecord = {
  teamId: string;
  categorySlug: string | null;
  level: string | null;
  name: string;
  seasonCode: string | null;
  active: boolean;
};

export type AhmvTeamDirectoryEnvelope = {
  eventId: string;
  type: "hockey.team_directory.sync";
  occurredAt: Date;
  mode: "full" | "delta";
  teams: AhmvPublicTeamRecord[];
};

const TEAM_ID_RE = /^[A-Za-z0-9._:-]+$/;
const SLUG_RE = /^[a-z0-9-]+$/;

function stringValue(
  value: unknown,
  max: number,
  required = false,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return required ? null : null;
  return trimmed.slice(0, max);
}

export function parseAhmvTeamDirectoryEnvelope(rawBody: string):
  | { valid: true; envelope: AhmvTeamDirectoryEnvelope }
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
  const eventId = stringValue(body.eventId, 160, true);
  const occurredAtRaw = stringValue(body.occurredAt, 80, true);
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : null;
  const mode = body.mode;
  const rawTeams = body.teams;

  if (
    !eventId ||
    body.type !== "hockey.team_directory.sync" ||
    !occurredAt ||
    !Number.isFinite(occurredAt.getTime()) ||
    (mode !== "full" && mode !== "delta") ||
    !Array.isArray(rawTeams) ||
    rawTeams.length > 500
  ) {
    return { valid: false, error: "Invalid AHMV team-directory envelope." };
  }

  const teams: AhmvPublicTeamRecord[] = [];
  const seen = new Set<string>();

  for (const rawTeam of rawTeams) {
    if (!rawTeam || typeof rawTeam !== "object" || Array.isArray(rawTeam)) {
      return { valid: false, error: "Invalid public team record." };
    }

    const team = rawTeam as Record<string, unknown>;
    const teamId = stringValue(team.teamId, 160, true);
    const name = stringValue(team.name, 180, true);
    const categorySlug = stringValue(team.categorySlug, 80);
    const level = stringValue(team.level, 120);
    const seasonCode = stringValue(team.seasonCode, 80);
    const active = team.active === undefined ? true : team.active;

    if (
      !teamId ||
      !TEAM_ID_RE.test(teamId) ||
      !name ||
      (categorySlug !== null && !SLUG_RE.test(categorySlug)) ||
      typeof active !== "boolean" ||
      seen.has(teamId)
    ) {
      return { valid: false, error: "Invalid or duplicate public team record." };
    }

    seen.add(teamId);
    teams.push({
      teamId,
      categorySlug,
      level,
      name,
      seasonCode,
      active,
    });
  }

  return {
    valid: true,
    envelope: {
      eventId,
      type: "hockey.team_directory.sync",
      occurredAt,
      mode,
      teams,
    },
  };
}
