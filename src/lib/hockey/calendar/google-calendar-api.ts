import "server-only";

import { ServiceError } from "@/lib/services/service-error";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TIMEOUT_MS = 15_000;

export class GoogleCalendarUnauthorizedError extends Error {
  constructor() {
    super("Google Calendar authorization expired.");
    this.name = "GoogleCalendarUnauthorizedError";
  }
}

type GoogleEventInput = {
  summary: string;
  description: string;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  teamEventId: string;
  sourceEventId: string;
  revision: string;
};

function eventBody(event: GoogleEventInput) {
  return {
    summary: event.summary,
    description: event.description,
    ...(event.location ? { location: event.location } : {}),
    start: {
      dateTime: event.startsAt.toISOString(),
      timeZone: event.timezone,
    },
    end: {
      dateTime: event.endsAt.toISOString(),
      timeZone: event.timezone,
    },
    reminders: { useDefault: true },
    extendedProperties: {
      private: {
        takatakSource: "ahmverdun",
        takatakTeamEventId: event.teamEventId,
        takatakSourceEventId: event.sourceEventId,
        takatakRevision: event.revision,
      },
    },
  };
}

async function googleRequest(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Record<string, unknown> | null> {
  const url = new URL(path, GOOGLE_CALENDAR_API);
  if (url.origin !== new URL(GOOGLE_CALENDAR_API).origin) {
    throw new ServiceError("invalid_input", "Invalid Google Calendar API path.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (response.status === 401) {
      throw new GoogleCalendarUnauthorizedError();
    }

    if (response.status === 404 && method === "DELETE") {
      return null;
    }

    if (!response.ok) {
      throw new ServiceError(
        "unavailable",
        `Google Calendar request failed with status ${response.status}.`,
      );
    }

    if (response.status === 204) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) return null;

    const parsed = (await response.json()) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch (error) {
    if (
      error instanceof GoogleCalendarUnauthorizedError ||
      error instanceof ServiceError
    ) {
      throw error;
    }
    throw new ServiceError(
      "unavailable",
      "Google Calendar is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function calendarPath(calendarId: string, suffix = ""): string {
  return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${suffix}`;
}

export async function createGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  event: GoogleEventInput;
}): Promise<string> {
  const record = await googleRequest(
    input.accessToken,
    "POST",
    calendarPath(input.calendarId),
    eventBody(input.event),
  );
  const id = record?.id;
  if (typeof id !== "string" || !id.trim()) {
    throw new ServiceError(
      "unavailable",
      "Google Calendar did not return an event ID.",
    );
  }
  return id.trim();
}

export async function updateGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  providerEventId: string;
  event: GoogleEventInput;
}): Promise<void> {
  await googleRequest(
    input.accessToken,
    "PUT",
    calendarPath(
      input.calendarId,
      `/${encodeURIComponent(input.providerEventId)}`,
    ),
    eventBody(input.event),
  );
}

export async function deleteGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  providerEventId: string;
}): Promise<void> {
  await googleRequest(
    input.accessToken,
    "DELETE",
    calendarPath(
      input.calendarId,
      `/${encodeURIComponent(input.providerEventId)}`,
    ),
  );
}
