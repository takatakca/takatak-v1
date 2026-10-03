import "server-only";

function configuredAllowedHosts(): Set<string> {
  const raw = process.env.AHMV_EVENT_ALLOWED_SOURCE_HOSTS?.trim();
  if (!raw) return new Set();

  const values = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return new Set(values);
}

export type AhmvEventSourceDecision =
  | { allowed: true; host: string }
  | {
      allowed: false;
      status: 400 | 403 | 503;
      code:
        | "source_required"
        | "source_invalid"
        | "source_not_allowed"
        | "source_allowlist_unconfigured";
      message: string;
    };

export function validateAhmvEventSourceUrl(
  value: string | null,
): AhmvEventSourceDecision {
  const allowedHosts = configuredAllowedHosts();

  // Fail closed whenever the signed event integration is enabled. This prevents
  // an accidentally enabled production connector from accepting provenance
  // until an exact source-host allowlist has been explicitly configured.
  if (
    process.env.AHMV_EVENT_SYNC_ENABLED === "true" &&
    allowedHosts.size === 0
  ) {
    return {
      allowed: false,
      status: 503,
      code: "source_allowlist_unconfigured",
      message: "AHMV event source allowlist is not configured.",
    };
  }

  const requireSource =
    process.env.AHMV_EVENT_REQUIRE_SOURCE_URL === "true";

  if (!value) {
    return {
      allowed: false,
      status: requireSource ? 400 : 403,
      code: "source_required",
      message: "A verified public source URL is required for AHMV events.",
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      allowed: false,
      status: 400,
      code: "source_invalid",
      message: "AHMV event source URL is invalid.",
    };
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port
  ) {
    return {
      allowed: false,
      status: 400,
      code: "source_invalid",
      message: "AHMV event source URL must be a standard HTTPS URL.",
    };
  }

  const host = url.hostname.toLowerCase();
  if (!allowedHosts.has(host)) {
    return {
      allowed: false,
      status: 403,
      code: "source_not_allowed",
      message: "AHMV event source is not on the approved public-source list.",
    };
  }

  return { allowed: true, host };
}

export function ahmvSourcePolicySummary() {
  const allowedHosts = configuredAllowedHosts();

  return {
    requireSourceUrl:
      process.env.AHMV_EVENT_REQUIRE_SOURCE_URL === "true",
    allowlistConfigured: allowedHosts.size > 0,
    allowedHosts: [...allowedHosts].sort(),
  };
}
