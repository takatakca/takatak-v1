// SSRF-safe page fetcher for SEO audits.
//
// - http/https on default ports only; hostnames only (no IP literals).
// - Every DNS answer is validated at connect time (custom lookup), so a
//   hostname that resolves to a private, loopback, link-local or otherwise
//   non-public address is refused — including after redirects.
// - Redirects are followed manually (max 4) and re-validated each hop.
// - Bounded time and body size; no cookies or credentials are ever sent.

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

export const SEO_USER_AGENT =
  "TAKATAK-SEO-Audit/1.0 (+https://takatak.ca)";
export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_MAX_BYTES = 1_500_000;
export const MAX_REDIRECTS = 4;

export type FetchedPage = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  truncated: boolean;
  elapsedMs: number;
  redirects: string[];
};

export class SafeFetchError extends Error {
  constructor(public readonly code:
    | "invalid_url"
    | "blocked_address"
    | "too_many_redirects"
    | "redirect_not_allowed"
    | "timeout"
    | "network_error") {
    super(code);
    this.name = "SafeFetchError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16",
  "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
];

/** True only for globally routable unicast addresses. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !BLOCKED_V4.some((cidr) => inV4(address, cidr));
  if (family !== 6) return false;

  const lower = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPublicAddress(mapped[1]);
  const nat64 = /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (nat64) return isPublicAddress(nat64[1]);
  if (lower === "::" || lower === "::1") return false;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:")) return false;
  if ((first & 0xe000) !== 0x2000) return false; // only 2000::/3 is global unicast
  return true;
}

/** Validates scheme, port and host shape; returns a normalized URL. */
export function parseAuditUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SafeFetchError("invalid_url");
  if (url.username || url.password || url.port) throw new SafeFetchError("invalid_url");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || isIP(host) || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new SafeFetchError("invalid_url");
  }
  url.hash = "";
  return url;
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/** DNS lookup that refuses any non-public answer (blocks DNS rebinding). */
export function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number } | number,
  callback: LookupCallback,
): void {
  const opts = typeof options === "number" ? { family: options } : options ?? {};
  dnsLookup(hostname, { all: true, family: opts.family ?? 0 }, (error, addresses) => {
    if (error) return callback(error, "");
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((entry) => !isPublicAddress(entry.address))) {
      const blocked = Object.assign(new Error("blocked_address"), { code: "EBLOCKED" });
      return callback(blocked as NodeJS.ErrnoException, "");
    }
    if (opts.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

function requestOnce(
  url: URL,
  timeoutMs: number,
  maxBytes: number,
): Promise<Omit<FetchedPage, "requestedUrl" | "finalUrl" | "redirects" | "elapsedMs">> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": SEO_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5",
          "Accept-Encoding": "identity",
        },
        lookup: guardedLookup as never,
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        let truncated = false;
        response.on("data", (chunk: Buffer) => {
          if (truncated) return;
          bytes += chunk.length;
          if (bytes > maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (bytes - maxBytes))));
            response.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
        });
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            if (typeof value === "string") headers[key.toLowerCase()] = value;
            else if (Array.isArray(value)) headers[key.toLowerCase()] = value.join(", ");
          }
          resolve({
            status: response.statusCode ?? 0,
            headers,
            body: Buffer.concat(chunks).toString("utf8"),
            bytes,
            truncated,
          });
        };
        response.on("end", finish);
        response.on("close", finish);
        response.on("error", () => finish());
      },
    );
    request.on("timeout", () => request.destroy(new SafeFetchError("timeout")));
    request.on("error", (error: NodeJS.ErrnoException) => {
      if (error instanceof SafeFetchError) return reject(error);
      if (error.code === "EBLOCKED" || error.message === "blocked_address") {
        return reject(new SafeFetchError("blocked_address"));
      }
      reject(new SafeFetchError("network_error"));
    });
    request.end();
  });
}

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  /** Decides whether a redirect target host may be followed. */
  allowHost: (host: string) => boolean;
};

export async function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<FetchedPage> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let url = parseAuditUrl(rawUrl);
  if (!options.allowHost(url.hostname.toLowerCase())) throw new SafeFetchError("redirect_not_allowed");

  const started = Date.now();
  const redirects: string[] = [];
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const result = await requestOnce(url, timeoutMs, maxBytes);
    const location = result.headers.location;
    if (result.status >= 300 && result.status < 400 && location) {
      if (hop === MAX_REDIRECTS) throw new SafeFetchError("too_many_redirects");
      const next = parseAuditUrl(new URL(location, url).toString());
      if (!options.allowHost(next.hostname.toLowerCase())) {
        throw new SafeFetchError("redirect_not_allowed");
      }
      redirects.push(next.toString());
      url = next;
      continue;
    }
    return {
      ...result,
      requestedUrl: rawUrl,
      finalUrl: url.toString(),
      redirects,
      elapsedMs: Date.now() - started,
    };
  }
  throw new SafeFetchError("too_many_redirects");
}
