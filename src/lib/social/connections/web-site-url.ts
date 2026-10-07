import "server-only";

import { isIP } from "node:net";

import { ServiceError } from "@/lib/services/service-error";

const PUBLIC_SITE_MESSAGE = "Enter a public https website address.";

export type NormalizedWebsite = {
  siteUrl: string;
  host: string;
};

export function isBlockedWebsiteIp(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase();
  if (!trimmed) return true;

  const mapped = trimmed.startsWith("::ffff:")
    ? trimmed.slice("::ffff:".length)
    : trimmed;

  if (isIP(mapped) === 4) {
    return isBlockedIpv4(mapped);
  }

  if (isIP(trimmed) === 6) {
    return isBlockedIpv6(trimmed);
  }

  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  if (ip === "::" || ip === "::1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) {
    return true;
  }
  if (ip.startsWith("ff")) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname === "metadata.google.internal"
  ) {
    return true;
  }

  return false;
}

function isPublicDnsName(hostname: string): boolean {
  if (hostname.length > 253 || hostname.includes("..")) return false;
  if (!/^[a-z0-9.-]+$/.test(hostname)) return false;

  const labels = hostname.split(".");
  if (labels.length < 2) return false;

  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      !label.startsWith("-") &&
      !label.endsWith("-"),
  );
}

export function sameWebsiteHost(left: string, right: string): boolean {
  if (left === right) return true;
  if (left === `www.${right}`) return true;
  if (right === `www.${left}`) return true;
  return false;
}

export function normalizePublicWebsiteUrl(value: string): NormalizedWebsite {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ServiceError("invalid_input", "Enter the website address.", {
      fieldErrors: { siteUrl: "Enter the website address." },
    });
  }

  if (trimmed.length > 2048) {
    throw new ServiceError("invalid_input", PUBLIC_SITE_MESSAGE, {
      fieldErrors: { siteUrl: PUBLIC_SITE_MESSAGE },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new ServiceError("invalid_input", PUBLIC_SITE_MESSAGE, {
      fieldErrors: { siteUrl: PUBLIC_SITE_MESSAGE },
    });
  }

  if (parsed.username || parsed.password) {
    throw new ServiceError("invalid_input", PUBLIC_SITE_MESSAGE, {
      fieldErrors: { siteUrl: PUBLIC_SITE_MESSAGE },
    });
  }

  if (parsed.protocol !== "https:") {
    throw new ServiceError("invalid_input", "Use https for the website address.", {
      fieldErrors: { siteUrl: "Use https for the website address." },
    });
  }

  if (parsed.port && parsed.port !== "443") {
    throw new ServiceError("invalid_input", PUBLIC_SITE_MESSAGE, {
      fieldErrors: { siteUrl: PUBLIC_SITE_MESSAGE },
    });
  }

  const host = parsed.hostname;
  const ipVersion = isIP(host);
  if (ipVersion !== 0) {
    if (isBlockedWebsiteIp(host)) {
      throw new ServiceError("invalid_input", PUBLIC_SITE_MESSAGE, {
        fieldErrors: { siteUrl: PUBLIC_SITE_MESSAGE },
      });
    }
  } else if (!isPublicDnsName(host) || isBlockedHostname(host)) {
    throw new ServiceError("invalid_input", PUBLIC_SITE_MESSAGE, {
      fieldErrors: { siteUrl: PUBLIC_SITE_MESSAGE },
    });
  }

  return {
    siteUrl: `https://${host}/`,
    host,
  };
}
