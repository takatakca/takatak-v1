export type AhmvScheduleStatus = "active" | "no_match";
export type AhmvScheduleEventStatus = "scheduled" | "cancelled";

export interface AhmvScheduleEvent {
  id: string;
  type: string;
  team?: string;
  category?: string;
  startsAt: string;
  endsAt?: string;
  status: AhmvScheduleEventStatus;
  opponent?: string;
  venue?: string;
  venueAddress?: string;
  officialUrl?: string;
  sourceUrl?: string;
}

export interface AhmvScheduleSnapshotInput {
  status: AhmvScheduleStatus;
  updatedAt: string;
  sourceUrl: string;
  events: AhmvScheduleEvent[];
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= max ? normalized : undefined;
}

function iso(value: unknown): string | undefined {
  const candidate = text(value, 80);
  if (!candidate) return undefined;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;
}

function https(value: unknown): string | undefined {
  const candidate = text(value, 1200);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function event(value: unknown): AhmvScheduleEvent | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const id = text(raw.id, 160);
  const type = text(raw.type, 80);
  const startsAt = iso(raw.startsAt);
  const status = raw.status;

  if (
    !id ||
    !type ||
    !startsAt ||
    (status !== "scheduled" && status !== "cancelled")
  ) {
    return undefined;
  }

  const result: AhmvScheduleEvent = {
    id,
    type,
    startsAt,
    status,
  };

  const optionalText: Array<
    [keyof Pick<
      AhmvScheduleEvent,
      "team" | "category" | "opponent" | "venue" | "venueAddress"
    >, unknown, number]
  > = [
    ["team", raw.team, 160],
    ["category", raw.category, 80],
    ["opponent", raw.opponent, 160],
    ["venue", raw.venue, 180],
    ["venueAddress", raw.venueAddress, 500],
  ];

  for (const [key, input, max] of optionalText) {
    const normalized = text(input, max);
    if (normalized) result[key] = normalized;
  }

  const endsAt = iso(raw.endsAt);
  if (endsAt) {
    if (Date.parse(endsAt) < Date.parse(startsAt)) return undefined;
    result.endsAt = endsAt;
  }

  const officialUrl = https(raw.officialUrl);
  const sourceUrl = https(raw.sourceUrl);
  if (officialUrl) result.officialUrl = officialUrl;
  if (sourceUrl) result.sourceUrl = sourceUrl;

  return result;
}

export function validateAhmvScheduleSnapshot(
  value: unknown,
  now = new Date(),
): AhmvScheduleSnapshotInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const status = raw.status;
  const updatedAt = iso(raw.updatedAt);
  const sourceUrl = https(raw.sourceUrl);
  const rawEvents = raw.events;

  if (
    (status !== "active" && status !== "no_match") ||
    !updatedAt ||
    !sourceUrl ||
    !Array.isArray(rawEvents) ||
    rawEvents.length > 1000
  ) {
    return null;
  }

  const updatedMs = Date.parse(updatedAt);
  if (
    updatedMs > now.getTime() + 5 * 60_000 ||
    updatedMs < now.getTime() - 30 * 86_400_000
  ) {
    return null;
  }

  const events = rawEvents
    .map(event)
    .filter((item): item is AhmvScheduleEvent => Boolean(item));

  if (events.length !== rawEvents.length) return null;
  if (status === "active" && events.length === 0) return null;
  if (status === "no_match" && events.length !== 0) return null;

  const ids = new Set<string>();
  for (const item of events) {
    if (ids.has(item.id)) return null;
    ids.add(item.id);
  }

  events.sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)
  );

  return { status, updatedAt, sourceUrl, events };
}

export function ahmvScheduleMaxAgeMinutes(
  env: Record<string, string | undefined> = process.env,
): number {
  const parsed = Number(env.AHMV_SCHEDULE_MAX_AGE_MINUTES ?? "360");
  return Number.isInteger(parsed) && parsed >= 5 && parsed <= 10080
    ? parsed
    : 360;
}

export function normalizeAhmvScheduleLookup(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function torontoDate(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function filterAhmvScheduleEvents(
  events: readonly AhmvScheduleEvent[],
  input: { team?: string; category?: string; date?: string },
): AhmvScheduleEvent[] {
  const team = input.team
    ? normalizeAhmvScheduleLookup(input.team)
    : "";
  const category = input.category
    ? normalizeAhmvScheduleLookup(input.category)
    : "";

  return events
    .filter((item) => {
      if (
        team &&
        normalizeAhmvScheduleLookup(item.team ?? "") !== team
      ) {
        return false;
      }
      if (
        category &&
        normalizeAhmvScheduleLookup(item.category ?? "") !== category
      ) {
        return false;
      }
      if (input.date && torontoDate(item.startsAt) !== input.date) {
        return false;
      }
      return true;
    })
    .slice(0, 100);
}
