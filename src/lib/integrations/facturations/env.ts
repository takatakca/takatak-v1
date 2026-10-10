// GROUPE TAKATAK Billing — Facturations integration environment.
// Presence metadata only: secret values are never returned or logged.
// Contract source: takatakca/Facturations docs/takatak-dashboard-integration-handoff-v1.md

export type FacturationsConnectionState =
  | "disabled"
  | "not_configured"
  | "configured_untested";

export interface FacturationsEnvStatus {
  state: FacturationsConnectionState;
  enabled: boolean;
  configured: boolean;
  /** Names of missing or invalid REQUIRED variables. Never values. */
  missing: string[];
}

export interface FacturationsConfig {
  origin: string;
  secret: string;
  issuer: string;
  audience: string;
  businessId: string;
}

export const FACTURATIONS_MIN_SECRET_LENGTH = 32;

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

/**
 * The Facturations origin must be an exact origin (no path, query or
 * credentials). HTTPS is mandatory except for loopback outside production.
 */
export function normalizeFacturationsOrigin(
  value: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string | null {
  if (!value) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    return null;
  }

  if (url.protocol === "https:") {
    return url.origin;
  }

  if (
    url.protocol === "http:" &&
    nodeEnv !== "production" &&
    isLoopbackHost(url.hostname)
  ) {
    return url.origin;
  }

  return null;
}

export function isFacturationsIntegrationEnabled(): boolean {
  return read("FACTURATIONS_INTEGRATION_ENABLED") === "1";
}

export function getFacturationsEnvStatus(): FacturationsEnvStatus {
  const enabled = isFacturationsIntegrationEnabled();
  const missing: string[] = [];

  if (!normalizeFacturationsOrigin(read("FACTURATIONS_ORIGIN"))) {
    missing.push("FACTURATIONS_ORIGIN");
  }

  if (
    read("FACTURATIONS_INTEGRATION_HMAC_SECRET").length <
    FACTURATIONS_MIN_SECRET_LENGTH
  ) {
    missing.push("FACTURATIONS_INTEGRATION_HMAC_SECRET");
  }

  if (!read("FACTURATIONS_INTEGRATION_ISSUER")) {
    missing.push("FACTURATIONS_INTEGRATION_ISSUER");
  }

  if (!read("FACTURATIONS_INTEGRATION_AUDIENCE")) {
    missing.push("FACTURATIONS_INTEGRATION_AUDIENCE");
  }

  if (!read("FACTURATIONS_BUSINESS_ID")) {
    missing.push("FACTURATIONS_BUSINESS_ID");
  }

  const configured = missing.length === 0;

  return {
    state: !enabled
      ? "disabled"
      : configured
        ? "configured_untested"
        : "not_configured",
    enabled,
    configured,
    missing,
  };
}

/** Returns the full server-side configuration, or null when unusable. */
export function getFacturationsConfig(): FacturationsConfig | null {
  const status = getFacturationsEnvStatus();

  if (!status.enabled || !status.configured) {
    return null;
  }

  const origin = normalizeFacturationsOrigin(read("FACTURATIONS_ORIGIN"));

  if (!origin) {
    return null;
  }

  return {
    origin,
    secret: read("FACTURATIONS_INTEGRATION_HMAC_SECRET"),
    issuer: read("FACTURATIONS_INTEGRATION_ISSUER"),
    audience: read("FACTURATIONS_INTEGRATION_AUDIENCE"),
    businessId: read("FACTURATIONS_BUSINESS_ID"),
  };
}
