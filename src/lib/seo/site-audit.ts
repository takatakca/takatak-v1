import "server-only";

// TAKATAK Site Audit — live, credential-free on-page SEO audit.
//
// Fetches one public page plus /robots.txt and the sitemap, then scores
// on-page fundamentals. Safety rules:
// - http/https only, no embedded credentials, default ports only;
// - every hop (including redirects) must resolve to public IP space;
// - hard timeout, redirect cap and response-size cap;
// - nothing is stored and no third-party API is called.
// Residual risk: DNS can change between our lookup and fetch's own lookup
// (rebinding). Acceptable for an authenticated dashboard tool; revisit if this
// is ever exposed publicly.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 1_500_000;
const MAX_TEXT_BYTES = 200_000;
const USER_AGENT = "TAKATAK-SiteAudit/1.0 (+https://takatak.ca)";

export type AuditCheckStatus = "pass" | "warn" | "fail";

export interface AuditCheck {
  id: string;
  label: string;
  status: AuditCheckStatus;
  detail: string;
  weight: number;
}

export interface SiteAuditReport {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  bytes: number;
  score: number;
  checks: AuditCheck[];
  facts: {
    title: string | null;
    description: string | null;
    h1: string[];
    wordCount: number;
    internalLinks: number;
    externalLinks: number;
    images: number;
  };
  auditedAt: string;
}

export type SiteAuditResult = { ok: true; report: SiteAuditReport } | { ok: false; error: string };

class AuditError extends Error {}

// ---------------------------------------------------------------- URL safety

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isPrivateV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (lower === "::" || lower === "::1") return true;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (lower.startsWith("64:ff9b:")) return true; // NAT64
  if (lower.startsWith("2001:db8:")) return true; // documentation
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateV4(ip);
  if (family === 6) return isPrivateV6(ip);
  return true;
}

export function normalizeAuditUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new AuditError("Enter a website address.");
  if (trimmed.length > 2048) throw new AuditError("That address is too long.");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new AuditError("That does not look like a valid website address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AuditError("Only http and https websites can be audited.");
  }
  if (url.username || url.password) throw new AuditError("Addresses with credentials are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new AuditError("Only standard web ports (80/443) can be audited.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") {
    throw new AuditError("Enter a public website domain.");
  }
  if (isIP(host) && isPrivateAddress(host)) throw new AuditError("Private network addresses cannot be audited.");
  url.hash = "";
  return url;
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new AuditError("Private network addresses cannot be audited.");
    return;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new AuditError(`Could not resolve ${host}. Check the domain and DNS.`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new AuditError("That domain resolves to a private network address and cannot be audited.");
  }
}

// ------------------------------------------------------------------ fetching

interface FetchedPage {
  url: URL;
  status: number;
  contentType: string;
  body: string;
  bytes: number;
  truncated: boolean;
  ms: number;
  xRobotsTag: string | null;
}

async function readCapped(response: Response, maxBytes: number): Promise<{ text: string; bytes: number; truncated: boolean }> {
  if (!response.body) return { text: "", bytes: 0, truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      chunks.push(value.subarray(0, value.byteLength - (bytes - maxBytes)));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString("utf8"), bytes: Math.min(bytes, maxBytes), truncated };
}

async function safeFetch(start: URL, maxBytes: number): Promise<FetchedPage> {
  let current = start;
  const started = Date.now();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(current);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new AuditError(timedOut ? `${current.host} did not respond within 10 seconds.` : `Could not connect to ${current.host}.`);
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      const next = normalizeAuditUrl(new URL(location, current).toString());
      current = next;
      continue;
    }
    const { text, bytes, truncated } = await readCapped(response, maxBytes);
    return {
      url: current,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body: text,
      bytes,
      truncated,
      ms: Date.now() - started,
      xRobotsTag: response.headers.get("x-robots-tag"),
    };
  }
  throw new AuditError("Too many redirects.");
}

async function tryFetchText(url: URL): Promise<FetchedPage | null> {
  try {
    return await safeFetch(url, MAX_TEXT_BYTES);
  } catch {
    return null;
  }
}

/** SSRF-guarded GET of one public page (used by website ownership checks). */
export async function fetchPublicPage(rawUrl: string): Promise<{ finalUrl: URL; status: number; body: string } | null> {
  try {
    const page = await safeFetch(normalizeAuditUrl(rawUrl), MAX_HTML_BYTES);
    return { finalUrl: page.url, status: page.status, body: page.body };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------- parsing

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const inner = tag.replace(/^<\s*[a-zA-Z0-9]+/, "").replace(/\/?>$/, "");
  let match: RegExpExecArray | null;
  while ((match = re.exec(inner))) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function tags(html: string, name: string): Array<Record<string, string>> {
  return Array.from(html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi")), (m) => parseAttributes(m[0]));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

// ------------------------------------------------------------------- scoring

function check(id: string, label: string, status: AuditCheckStatus, detail: string, weight = 1): AuditCheck {
  return { id, label, status, detail, weight };
}

function robotsBlocksAll(robots: string): boolean {
  let appliesToAll = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim().toLowerCase();
    if (!line) continue;
    if (line.startsWith("user-agent:")) appliesToAll = line.slice(11).trim() === "*";
    else if (appliesToAll && line.replace(/\s+/g, "") === "disallow:/") return true;
  }
  return false;
}

export async function runSiteAudit(rawUrl: string): Promise<SiteAuditResult> {
  try {
    const requested = normalizeAuditUrl(rawUrl);
    const page = await safeFetch(requested, MAX_HTML_BYTES);
    if (!/html/i.test(page.contentType) && !/<html/i.test(page.body.slice(0, 2000))) {
      return { ok: false, error: `The address returned ${page.contentType || "non-HTML content"}, not a web page.` };
    }

    const html = page.body;
    const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? html;
    const metas = tags(head, "meta");
    const metaBy = (key: string) =>
      metas.find((m) => (m.name ?? m.property ?? "").toLowerCase() === key)?.content?.trim() || null;

    const title = decodeEntities(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null;
    const description = metaBy("description");
    const robotsMeta = `${metaBy("robots") ?? ""} ${page.xRobotsTag ?? ""}`.toLowerCase();
    const canonical = tags(head, "link").find((l) => (l.rel ?? "").toLowerCase().split(/\s+/).includes("canonical"))?.href ?? null;
    const viewport = metaBy("viewport");
    const lang = html.match(/<html\b[^>]*\blang\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? null;
    const h1 = Array.from(html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi), (m) => stripTags(m[1])).filter(Boolean);
    const h2Count = (html.match(/<h2\b/gi) ?? []).length;
    const images = tags(html, "img");
    const imagesMissingAlt = images.filter((img) => !("alt" in img)).length;
    const jsonLdCount = (html.match(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json/gi) ?? []).length;
    const ogTitle = metaBy("og:title");
    const ogImage = metaBy("og:image");
    const favicon = tags(head, "link").some((l) => /\bicon\b/i.test(l.rel ?? ""));
    const words = stripTags(html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

    let internalLinks = 0;
    let externalLinks = 0;
    for (const a of tags(html, "a")) {
      if (!a.href || /^(#|mailto:|tel:|javascript:)/i.test(a.href)) continue;
      try {
        if (new URL(a.href, page.url).host === page.url.host) internalLinks += 1;
        else externalLinks += 1;
      } catch {
        // ignore malformed hrefs
      }
    }

    const origin = new URL(page.url.origin);
    const robots = await tryFetchText(new URL("/robots.txt", origin));
    const robotsOk = robots !== null && robots.status === 200 && !/<html/i.test(robots.body.slice(0, 500));
    const sitemapFromRobots = robotsOk ? robots?.body.match(/^\s*sitemap:\s*(\S+)/im)?.[1] ?? null : null;
    let sitemapUrl: URL;
    try {
      sitemapUrl = sitemapFromRobots ? normalizeAuditUrl(sitemapFromRobots) : new URL("/sitemap.xml", origin);
    } catch {
      sitemapUrl = new URL("/sitemap.xml", origin);
    }
    const sitemap = await tryFetchText(sitemapUrl);
    const sitemapOk = sitemap !== null && sitemap.status === 200 && /<(urlset|sitemapindex)\b/i.test(sitemap.body);

    const checks: AuditCheck[] = [
      page.status === 200
        ? check("status", "Page loads", "pass", "Responded with HTTP 200.", 3)
        : check("status", "Page loads", "fail", `Responded with HTTP ${page.status}.`, 3),
      page.url.protocol === "https:"
        ? check("https", "Secure (HTTPS)", "pass", "Served over HTTPS.", 3)
        : check("https", "Secure (HTTPS)", "fail", "Served over plain HTTP. Install SSL and redirect to HTTPS.", 3),
      page.ms <= 1500
        ? check("speed", "Server response time", "pass", `${page.ms} ms including redirects.`, 2)
        : check("speed", "Server response time", page.ms <= 4000 ? "warn" : "fail", `${page.ms} ms including redirects. Aim for under 1.5 s.`, 2),
      !title
        ? check("title", "Title tag", "fail", "Missing <title>. This is the headline shown on Google.", 3)
        : title.length < 20 || title.length > 65
          ? check("title", "Title tag", "warn", `${title.length} characters. Aim for 20–65.`, 3)
          : check("title", "Title tag", "pass", `${title.length} characters.`, 3),
      !description
        ? check("description", "Meta description", "fail", "Missing. Google will improvise the snippet.", 2)
        : description.length < 70 || description.length > 160
          ? check("description", "Meta description", "warn", `${description.length} characters. Aim for 70–160.`, 2)
          : check("description", "Meta description", "pass", `${description.length} characters.`, 2),
      h1.length === 1
        ? check("h1", "One H1 heading", "pass", `“${h1[0].slice(0, 80)}”`, 2)
        : check("h1", "One H1 heading", h1.length === 0 ? "fail" : "warn", h1.length === 0 ? "No H1 found." : `${h1.length} H1 tags found. Use exactly one.`, 2),
      h2Count > 0
        ? check("h2", "Section headings (H2)", "pass", `${h2Count} H2 headings.`, 1)
        : check("h2", "Section headings (H2)", "warn", "No H2 headings. Structure content into sections.", 1),
      /noindex/.test(robotsMeta)
        ? check("indexable", "Indexable by Google", "fail", "Page is marked noindex — it will not appear in search.", 3)
        : check("indexable", "Indexable by Google", "pass", "No noindex directive.", 3),
      canonical
        ? check("canonical", "Canonical URL", "pass", canonical.slice(0, 120), 1)
        : check("canonical", "Canonical URL", "warn", "No canonical link. Add one to avoid duplicate-content issues.", 1),
      viewport
        ? check("viewport", "Mobile viewport", "pass", "Viewport meta tag present.", 2)
        : check("viewport", "Mobile viewport", "fail", "Missing viewport meta tag. The page will not scale on phones.", 2),
      lang
        ? check("lang", "Language declared", "pass", `lang="${lang}"`, 1)
        : check("lang", "Language declared", "warn", "No lang attribute on <html>.", 1),
      images.length === 0 || imagesMissingAlt === 0
        ? check("alt", "Image alt text", "pass", images.length ? `All ${images.length} images have alt text.` : "No images on the page.", 1)
        : check("alt", "Image alt text", "warn", `${imagesMissingAlt} of ${images.length} images have no alt attribute.`, 1),
      words.length >= 300
        ? check("content", "Content depth", "pass", `${words.length} words.`, 2)
        : check("content", "Content depth", "warn", `${words.length} words. Thin pages rarely rank; aim for 300+.`, 2),
      ogTitle && ogImage
        ? check("social", "Social share preview", "pass", "Open Graph title and image set.", 1)
        : check("social", "Social share preview", "warn", "Missing og:title or og:image. Shares on Facebook/LinkedIn look bare.", 1),
      jsonLdCount > 0
        ? check("schema", "Structured data", "pass", `${jsonLdCount} JSON-LD block(s).`, 1)
        : check("schema", "Structured data", "warn", "No JSON-LD. Add LocalBusiness schema for rich results.", 1),
      favicon
        ? check("favicon", "Favicon", "pass", "Icon link present.", 1)
        : check("favicon", "Favicon", "warn", "No favicon link found.", 1),
      !robotsOk
        ? check("robots", "robots.txt", "warn", "No robots.txt found.", 1)
        : robotsBlocksAll(robots?.body ?? "")
          ? check("robots", "robots.txt", "fail", "robots.txt blocks all crawlers (Disallow: /).", 1)
          : check("robots", "robots.txt", "pass", "robots.txt found and allows crawling.", 1),
      sitemapOk
        ? check("sitemap", "XML sitemap", "pass", `Found at ${sitemapUrl.pathname}.`, 1)
        : check("sitemap", "XML sitemap", "warn", "No valid XML sitemap found. Submit one in Search Console.", 1),
    ];
    if (page.truncated) {
      checks.push(check("size", "Page weight", "warn", "HTML is over 1.5 MB; only the first part was audited.", 1));
    }

    const total = checks.reduce((sum, c) => sum + c.weight, 0);
    const earned = checks.reduce((sum, c) => sum + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);

    return {
      ok: true,
      report: {
        requestedUrl: requested.toString(),
        finalUrl: page.url.toString(),
        statusCode: page.status,
        responseMs: page.ms,
        bytes: page.bytes,
        score: Math.round((earned / total) * 100),
        checks,
        facts: {
          title,
          description,
          h1: h1.slice(0, 5),
          wordCount: words.length,
          internalLinks,
          externalLinks,
          images: images.length,
        },
        auditedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuditError) return { ok: false, error: error.message };
    console.error("[seo] site audit failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "The audit could not be completed. Try again in a moment." };
  }
}
