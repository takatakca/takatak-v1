import "server-only";

// Checks a public website's security from the outside: the https home page
// and its headers, the http:// redirect and the certificate. Every
// connection goes to a resolved public address only (the same SSRF guards as
// the SEO site audit), with short timeouts. Nothing is stored.
import tls from "node:tls";

import { AuditError, normalizeAuditUrl, requestPinned, resolvePublicAddress } from "@/lib/seo/site-audit";

import { gradeSecurity, type SecurityReport } from "./security-grade";

const TIMEOUT_MS = 8_000;
const MAX_HOPS = 4;
const USER_AGENT = "TAKATAK-SecurityCheck/1.0 (+https://takatak.ca)";

export type SecurityCheckResult = { ok: true; report: SecurityReport } | { ok: false; error: string };

function flatten(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[name.toLowerCase()] = (Array.isArray(value) ? value.join(", ") : value).slice(0, 2000);
  }
  return out;
}

/** GET with redirects followed on public addresses only; returns the last response's status and headers. */
async function follow(start: URL): Promise<{ url: URL; status: number; headers: Record<string, string> }> {
  let current = start;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const pinned = await resolvePublicAddress(current);
    const response = await requestPinned(current, pinned, { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.5" }, TIMEOUT_MS);
    response.body.destroy();
    const headers = flatten(response.headers);
    const location = headers.location;
    if (response.status >= 300 && response.status < 400 && location) {
      current = normalizeAuditUrl(new URL(location, current).toString());
      continue;
    }
    return { url: current, status: response.status, headers };
  }
  throw new AuditError("Too many redirects.");
}

/** Where http:// first sends visitors: true when it is an https:// address. */
async function httpRedirect(host: string): Promise<boolean | null> {
  try {
    const url = new URL(`http://${host}/`);
    const pinned = await resolvePublicAddress(url);
    const response = await requestPinned(url, pinned, { "user-agent": USER_AGENT }, TIMEOUT_MS);
    response.body.destroy();
    const location = flatten(response.headers).location;
    if (response.status >= 300 && response.status < 400 && location) {
      return new URL(location, url).protocol === "https:";
    }
    return false;
  } catch {
    return null;
  }
}

async function certificate(host: string): Promise<{ trusted: boolean; daysLeft: number | null; issuer: string | null } | null> {
  let pinned;
  try {
    pinned = await resolvePublicAddress(new URL(`https://${host}/`));
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const socket = tls.connect({ host: pinned.address, port: 443, servername: host, rejectUnauthorized: false, timeout: TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate();
      const trusted = socket.authorized;
      socket.end();
      if (!cert || !cert.valid_to) return resolve(null);
      const daysLeft = Math.floor((Date.parse(cert.valid_to) - Date.now()) / 86_400_000);
      const issuer = typeof cert.issuer?.O === "string" ? cert.issuer.O.slice(0, 80) : null;
      resolve({ trusted, daysLeft: Number.isFinite(daysLeft) ? daysLeft : null, issuer });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
    socket.on("error", () => resolve(null));
  });
}

export async function runSecurityCheck(rawUrl: string): Promise<SecurityCheckResult> {
  let host: string;
  try {
    host = normalizeAuditUrl(rawUrl).hostname.toLowerCase();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Adresse invalide · Invalid address." };
  }
  const [page, redirect, cert] = await Promise.all([
    follow(new URL(`https://${host}/`)).catch(() => null),
    httpRedirect(host),
    certificate(host),
  ]);
  if (!page && redirect === null && !cert) {
    return { ok: false, error: `Impossible de joindre ${host} · Could not reach ${host}.` };
  }
  return {
    ok: true,
    report: gradeSecurity({
      host,
      httpsOk: Boolean(page && page.url.protocol === "https:" && page.status < 500),
      httpRedirectsToHttps: redirect,
      headers: page?.headers ?? {},
      certificate: cert,
    }),
  };
}
