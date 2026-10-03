import "server-only";

import { ServiceError } from "@/lib/services/service-error";

const ROUTES_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const TIMEOUT_MS = 12_000;

export type HockeyRouteWaypoint =
  | { address: string }
  | { latitude: number; longitude: number };

export type HockeyTrafficRoute = {
  durationSeconds: number;
  staticDurationSeconds: number;
  distanceMeters: number | null;
};

function getGoogleRoutesApiKey(): string {
  const value = process.env.GOOGLE_ROUTES_API_KEY?.trim() ?? "";
  if (!value) {
    throw new ServiceError(
      "unavailable",
      "Smart departure routing is not configured.",
    );
  }
  return value;
}

export function isGoogleRoutesConfigured(): boolean {
  return Boolean(
    process.env.HOCKEY_SMART_DEPARTURE_ENABLED === "true" &&
      process.env.GOOGLE_ROUTES_API_KEY?.trim(),
  );
}

export function parseGoogleDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function waypoint(value: HockeyRouteWaypoint) {
  if ("address" in value) {
    const address = value.address.replace(/\s+/g, " ").trim();
    if (!address) {
      throw new ServiceError("invalid_input", "A route address is required.");
    }
    return { address };
  }

  if (
    !Number.isFinite(value.latitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    throw new ServiceError("invalid_input", "Route coordinates are invalid.");
  }

  return {
    location: {
      latLng: {
        latitude: value.latitude,
        longitude: value.longitude,
      },
    },
  };
}

export async function computeTrafficAwareHockeyRoute(input: {
  origin: HockeyRouteWaypoint;
  destination: HockeyRouteWaypoint;
  departureTime?: Date;
  locale?: string | null;
}): Promise<HockeyTrafficRoute> {
  if (!isGoogleRoutesConfigured()) {
    throw new ServiceError(
      "unavailable",
      "Smart departure routing is not configured.",
    );
  }

  const locale = input.locale?.toLowerCase().startsWith("en")
    ? "en-CA"
    : input.locale?.toLowerCase().startsWith("es")
      ? "es"
      : "fr-CA";

  const body = {
    origin: waypoint(input.origin),
    destination: waypoint(input.destination),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    departureTime: (input.departureTime ?? new Date()).toISOString(),
    computeAlternativeRoutes: false,
    languageCode: locale,
    regionCode: "CA",
    units: "METRIC",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ROUTES_ENDPOINT, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Goog-Api-Key": getGoogleRoutesApiKey(),
        "X-Goog-FieldMask":
          "routes.duration,routes.staticDuration,routes.distanceMeters",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ServiceError(
        "unavailable",
        `Google Routes could not calculate the trip (status ${response.status}).`,
      );
    }

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ServiceError(
        "unavailable",
        "Google Routes returned an invalid response.",
      );
    }

    const routes = (payload as Record<string, unknown>).routes;
    if (!Array.isArray(routes) || routes.length === 0) {
      throw new ServiceError(
        "not_found",
        "No driving route was found for this arena.",
      );
    }

    const first = routes[0];
    if (!first || typeof first !== "object" || Array.isArray(first)) {
      throw new ServiceError(
        "unavailable",
        "Google Routes returned an invalid route.",
      );
    }

    const route = first as Record<string, unknown>;
    const durationSeconds = parseGoogleDurationSeconds(route.duration);
    const staticDurationSeconds =
      parseGoogleDurationSeconds(route.staticDuration) ?? durationSeconds;

    if (
      durationSeconds === null ||
      staticDurationSeconds === null
    ) {
      throw new ServiceError(
        "unavailable",
        "Google Routes did not return a usable travel time.",
      );
    }

    const distance =
      typeof route.distanceMeters === "number" &&
      Number.isFinite(route.distanceMeters)
        ? route.distanceMeters
        : null;

    return {
      durationSeconds,
      staticDurationSeconds,
      distanceMeters: distance,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      "unavailable",
      "Smart departure routing is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
