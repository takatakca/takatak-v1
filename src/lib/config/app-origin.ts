import { brand } from "@/lib/website/brand";

export const PRODUCTION_APP_ORIGIN = `https://${brand.domain}`;
export const LOCAL_APP_ORIGIN = "http://localhost:3000";

export function isProductionAppRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function isBindHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1"
  );
}

/**
 * Local `.env` may keep localhost. On a production upload, those
 * localhost / bind hosts resolve to the public TAKATAK origin instead.
 */
export function resolvePublicUrl(value: string): URL {
  const parsed = new URL(value);

  if (isProductionAppRuntime() && isBindHostname(parsed.hostname)) {
    parsed.protocol = "https:";
    parsed.host = brand.domain;
  }

  return parsed;
}

export function getApplicationOrigin(
  requestOrigin?: string | null,
): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    try {
      return resolvePublicUrl(configured).origin;
    } catch {
      // Invalid configuration falls through.
    }
  }

  if (requestOrigin) {
    try {
      return resolvePublicUrl(requestOrigin).origin;
    } catch {
      // Ignore malformed request origins.
    }
  }

  if (isProductionAppRuntime()) {
    return PRODUCTION_APP_ORIGIN;
  }

  return LOCAL_APP_ORIGIN;
}

export function originFromRequest(request: Request): string {
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const hostname = forwardedHost.split(":")[0]?.replace(/^\[|\]$/g, "") ?? "";

    if (hostname && !isBindHostname(hostname)) {
      const proto =
        forwardedProto === "http" || forwardedProto === "https"
          ? forwardedProto
          : isProductionAppRuntime()
            ? "https"
            : "http";

      try {
        return resolvePublicUrl(`${proto}://${forwardedHost}`).origin;
      } catch {
        // Fall through to request.url / configured origin.
      }
    }
  }

  try {
    return getApplicationOrigin(new URL(request.url).origin);
  } catch {
    return getApplicationOrigin();
  }
}
