import "server-only";

const DEFAULT_ALLOWED_HOSTS = new Set([
  "ahmverdun.ca",
  "www.ahmverdun.ca",
  "ahmverdun.com",
  "www.ahmverdun.com",
  "scoresheets.ca",
  "www.scoresheets.ca",
  "retroaction.ca",
  "www.retroaction.ca",
]);

function configuredAllowedHosts(): Set<string> {
  const raw = process.env.AHMV_EVENT_ALLOWED_SOURCE_HOSTS?.trim();
  if (!raw) return DEFAULT_ALLOWED_HOSTS;

  const values = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return new Set(values);
}

export type AhmvEventSourceDecision =
  | { allowed: true; host: string | null }
  | {
      allowed: false;
      status: 400 | 403;
      code: "source_required" | "source_invalid" | "source_not_allowed";
      message: string;
    };

export function validateAhmvEventSourceUrl(
  value: string | null,
): AhmvEventSourceDecision {
  const requireSource =
    process.env.AHMV_EVENT_REQUIRE_SOURCE_URL === "true";

  if (!value) {
    if (requireSource) {
      return {
        allowed: false,
        status: 400,
        code: "source_required",
        message: "A verified public source URL is required for AHMV events.",
      };
    }
    return { allowed: true, host: null };
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

  if (url.protocol !== "https:") {
    return {
      allowed: false,
      status: 400,
      code: "source_invalid",
      message: "AHMV event source URL must use HTTPS.",
    };
  }

  const host = url.hostname.toLowerCase();
  if (!configuredAllowedHosts().has(host)) {
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
  return {
    requireSourceUrl:
      process.env.AHMV_EVENT_REQUIRE_SOURCE_URL === "true",
    allowedHosts: [...configuredAllowedHosts()].sort(),
  };
}
