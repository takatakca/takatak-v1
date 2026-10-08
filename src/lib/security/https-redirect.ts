// Sends plain-HTTP visitors of the public site to HTTPS (TK-015).
//
// The host (Apache + Passenger) forwards the original scheme in
// `x-forwarded-proto`. A redirect is issued only when that header explicitly
// says "http", so HTTPS traffic and local development can never loop.

const PUBLIC_HOSTS = new Set(["takatak.ca", "www.takatak.ca"]);

/** Paths answered over plain HTTP: liveness probes and certificate checks. */
function isExemptPath(pathname: string): boolean {
  return (
    pathname === "/api/health" ||
    pathname.startsWith("/api/health/") ||
    pathname.startsWith("/.well-known/")
  );
}

export function httpsRedirectTarget(input: {
  headers: Headers;
  pathname: string;
  search: string;
  production: boolean;
}): string | null {
  if (!input.production) return null;
  if (input.headers.get("x-forwarded-proto")?.trim().toLowerCase() !== "http") return null;
  if (isExemptPath(input.pathname)) return null;

  const rawHost = input.headers.get("x-forwarded-host") ?? input.headers.get("host") ?? "";
  const host = rawHost.split(",")[0].trim().toLowerCase().replace(/:80$/, "");
  if (!PUBLIC_HOSTS.has(host)) return null;

  return `https://${host}${input.pathname}${input.search}`;
}
