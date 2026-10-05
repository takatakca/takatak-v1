import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import type { HockeyTravelOrigin } from "./travel-crypto";

const ROUTES_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const TIMEOUT_MS = 12_000;

export type HockeyRouteDestination =
  | { latitude: number; longitude: number }
  | { address: string };

export type HockeyTrafficRoute = {
  durationSeconds: number;
  staticDurationSeconds: number | null;
  trafficDelaySeconds: number;
  distanceMeters: number | null;
};

function apiKey(): string {
  return process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim() ?? "";
}

export function isHockeySmartDepartureConfigured(): boolean {
  return Boolean(
    process.env.HOCKEY_SMART_DEPARTURE_ENABLED === "true" &&
      apiKey(),
  );
}

function durationSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.ceil(seconds)
    : null;
}

function destinationWaypoint(destination: HockeyRouteDestination) {
  if ("address" in destination) {
    const address = destination.address.trim();
    if (!address || address.length > 500) {
      throw new ServiceError("invalid_input", "Arena address is invalid.");
    }
    return { address };
  }

  if (
    !Number.isFinite(destination.latitude) ||
    destination.latitude < -90 ||
    destination.latitude > 90 ||
    !Number.isFinite(destination.longitude) ||
    destination.longitude < -180 ||
    destination.longitude > 180
  ) {
    throw new ServiceError("invalid_input", "Arena coordinates are invalid.");
  }

  return {
    location: {
      latLng: {
        latitude: destination.latitude,
        longitude: destination.longitude,
      },
    },
  };
}

export async function computeHockeyTrafficRoute(input: {
  origin: HockeyTravelOrigin;
  destination: HockeyRouteDestination;
}): Promise<HockeyTrafficRoute> {
  if (!isHockeySmartDepartureConfigured()) {
    throw new ServiceError(
      "unavailable",
      "Smart-departure routing is not configured.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ROUTES_ENDPOINT, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask":
          "routes.duration,routes.staticDuration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: input.origin.latitude,
              longitude: input.origin.longitude,
            },
          },
        },
        destination: destinationWaypoint(input.destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE_OPTIMAL",
        languageCode: "fr-CA",
        regionCode: "CA",
        units: "METRIC",
      }),
    });

    const type = response.headers.get("content-type") ?? "";
    const payload: unknown = type.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      throw new ServiceError(
        "unavailable",
        `Routes API failed with status ${response.status}.`,
      );
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ServiceError(
        "unavailable",
        "Routes API returned an invalid response.",
      );
    }

    const routes = (payload as Record<string, unknown>).routes;
    const route =
      Array.isArray(routes) &&
      routes[0] &&
      typeof routes[0] === "object" &&
      !Array.isArray(routes[0])
        ? (routes[0] as Record<string, unknown>)
        : null;

    if (!route) {
      throw new ServiceError("not_found", "No driving route was found.");
    }

    const duration = durationSeconds(route.duration);
    const staticDuration = durationSeconds(route.staticDuration);

    if (duration === null) {
      throw new ServiceError(
        "unavailable",
        "Routes API did not return a travel duration.",
      );
    }

    const distance =
      typeof route.distanceMeters === "number" &&
      Number.isFinite(route.distanceMeters) &&
      route.distanceMeters >= 0
        ? Math.round(route.distanceMeters)
        : null;

    return {
      durationSeconds: duration,
      staticDurationSeconds: staticDuration,
      trafficDelaySeconds:
        staticDuration === null ? 0 : Math.max(0, duration - staticDuration),
      distanceMeters: distance,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      "unavailable",
      "Traffic-aware routing is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
