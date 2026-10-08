import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ServiceError } from "@/lib/services/service-error";
import {
  isBlockedWebsiteIp,
  normalizePublicWebsiteUrl,
  sameWebsiteHost,
} from "@/lib/social/connections/web-site-url";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 512_000;

const UNREACHABLE =
  "The website could not be reached. Check the address and try again.";
const UNREADABLE =
  "TAKATAK could not read the public homepage. Publish the verification tag there and try again.";

async function assertPublicResolution(hostname: string): Promise<void> {
  if (isIP(hostname) !== 0) {
    if (isBlockedWebsiteIp(hostname)) {
      throw new ServiceError("invalid_input", "Enter a public https website address.");
    }
    return;
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ServiceError("unavailable", UNREACHABLE, { status: 502 });
  }

  if (
    records.length === 0 ||
    records.some((record) => isBlockedWebsiteIp(record.address))
  ) {
    throw new ServiceError("invalid_input", "Enter a public https website address.");
  }
}

async function readLimitedHtml(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new ServiceError("unavailable", UNREADABLE, { status: 502 });
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new ServiceError(
        "unavailable",
        "The homepage was too large to verify.",
        { status: 502 },
      );
    }
    chunks.push(value);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  if (!body.trim()) {
    throw new ServiceError("unavailable", UNREADABLE, { status: 502 });
  }
  return body;
}

export async function fetchPublicHomepageHtml(
  siteUrl: string,
): Promise<string> {
  const start = normalizePublicWebsiteUrl(siteUrl);
  let current = start.siteUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = normalizePublicWebsiteUrl(current);
    if (!sameWebsiteHost(start.host, target.host)) {
      throw new ServiceError("unavailable", UNREADABLE, { status: 502 });
    }

    await assertPublicResolution(target.host);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(target.siteUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "TAKATAK-Site-Verification/1.0",
        },
      });
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceError("unavailable", UNREACHABLE, { status: 503 });
      }
      throw new ServiceError("unavailable", UNREACHABLE, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    const status = response.status;
    if (status >= 300 && status < 400) {
      const location = response.headers.get("location");
      if (!location || hop === MAX_REDIRECTS) {
        throw new ServiceError("unavailable", UNREADABLE, { status: 502 });
      }
      current = new URL(location, target.siteUrl).toString();
      continue;
    }

    if (status !== 200) {
      throw new ServiceError("unavailable", UNREADABLE, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new ServiceError("unavailable", UNREADABLE, { status: 502 });
    }

    return readLimitedHtml(response);
  }

  throw new ServiceError("unavailable", UNREADABLE, { status: 502 });
}
