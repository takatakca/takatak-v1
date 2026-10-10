// SEO audit orchestration: crawl a bounded set of pages of ONE website and
// evaluate them. The fetcher is injectable for tests; production uses the
// SSRF-safe fetcher.

import {
  evaluateSite,
  scoreIssues,
  summarize,
  type AuditIssue,
  type PageFacts,
  type SiteFacts,
} from "./checks";
import { extractSignals, extractSitemapUrls, parseRobots } from "./html";
import { safeFetch, type FetchedPage } from "./safe-fetch";

export const MAX_PAGES = 10;
export const TIME_BUDGET_MS = 35_000;
export const PAGE_TIMEOUT_MS = 6_000;

export type Fetcher = (url: string, allowHost: (host: string) => boolean) => Promise<FetchedPage>;

export const defaultFetcher: Fetcher = (url, allowHost) =>
  safeFetch(url, { allowHost, timeoutMs: PAGE_TIMEOUT_MS });

export type AuditResult = {
  host: string;
  site: SiteFacts;
  pages: PageFacts[];
  issues: AuditIssue[];
  score: number;
  summary: { critical: number; warning: number; notice: number; pagesScanned: number };
};

/** Normalizes "https://www.Example.ca/path" or "example.ca" to "example.ca". */
export function normalizeHost(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/\.$/, "");
  if (!/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) return null;
  return host.replace(/^www\./, "");
}

export function hostMatcher(host: string): (candidate: string) => boolean {
  return (candidate) => {
    const bare = candidate.toLowerCase().replace(/^www\./, "");
    return bare === host;
  };
}

function normalizePageUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

function isHtml(page: FetchedPage): boolean {
  const type = page.headers["content-type"] ?? "";
  return !type || /html/i.test(type);
}

export async function runAudit(
  hostInput: string,
  options: { fetcher?: Fetcher; now?: () => number } = {},
): Promise<AuditResult> {
  const host = normalizeHost(hostInput);
  if (!host) throw new Error("invalid_host");
  const fetcher = options.fetcher ?? defaultFetcher;
  const now = options.now ?? Date.now;
  const started = now();
  const allowHost = hostMatcher(host);
  const tryFetch = async (url: string): Promise<FetchedPage | null> => {
    try {
      return await fetcher(url, allowHost);
    } catch {
      return null;
    }
  };

  // 1. Homepage over HTTPS (bare host first, then www).
  let home = await tryFetch(`https://${host}/`);
  if (!home || home.status >= 400) {
    const www = await tryFetch(`https://www.${host}/`);
    if (www && (!home || www.status < 400)) home = www;
  }
  const httpsReachable = Boolean(home && home.status < 400 && home.finalUrl.startsWith("https://"));
  const origin = home ? new URL(home.finalUrl).origin : `https://${host}`;

  // 2. Does plain HTTP land on HTTPS?
  const http = await tryFetch(`http://${host}/`);
  const httpRedirectsToHttps = http ? http.finalUrl.startsWith("https://") : null;

  // 3. robots.txt and sitemap.
  const robotsPage = await tryFetch(`${origin}/robots.txt`);
  const robotsFound = Boolean(robotsPage && robotsPage.status === 200 && !/html/i.test(robotsPage.headers["content-type"] ?? ""));
  const robots = robotsFound && robotsPage ? parseRobots(robotsPage.body) : { sitemaps: [], blocksAll: false };

  const sitemapCandidates = [
    ...robots.sitemaps.filter((url) => {
      try {
        return allowHost(new URL(url).hostname);
      } catch {
        return false;
      }
    }),
    `${origin}/sitemap.xml`,
  ].slice(0, 3);
  let sitemapFound = false;
  let sitemapUrls: string[] = [];
  for (const candidate of sitemapCandidates) {
    const page = await tryFetch(candidate);
    if (!page || page.status !== 200) continue;
    if (/<sitemapindex\b/i.test(page.body)) {
      sitemapFound = true;
      const child = extractSitemapUrls(page.body, host, 1)[0];
      const childPage = child ? await tryFetch(child) : null;
      if (childPage && childPage.status === 200) sitemapUrls = extractSitemapUrls(childPage.body, host);
      break;
    }
    if (/<urlset\b/i.test(page.body)) {
      sitemapFound = true;
      sitemapUrls = extractSitemapUrls(page.body, host);
      break;
    }
  }

  // 4. Pages: homepage + sitemap entries + homepage links, bounded.
  const pages: PageFacts[] = [];
  const seen = new Set<string>();
  const queue: string[] = [];
  if (home) {
    seen.add(normalizePageUrl(home.finalUrl));
    const signals = isHtml(home) ? extractSignals(home.body, home.finalUrl) : null;
    pages.push({
      url: home.finalUrl,
      isHome: true,
      status: home.status,
      error: null,
      elapsedMs: home.elapsedMs,
      bytes: home.bytes,
      xRobotsTag: home.headers["x-robots-tag"] ?? null,
      signals,
    });
    queue.push(...sitemapUrls, ...(signals?.internalLinks ?? []));
  } else {
    pages.push({
      url: `https://${host}/`, isHome: true, status: null, error: "unreachable",
      elapsedMs: 0, bytes: 0, xRobotsTag: null, signals: null,
    });
  }

  for (const candidate of queue) {
    if (pages.length >= MAX_PAGES || now() - started > TIME_BUDGET_MS) break;
    let key: string;
    try {
      key = normalizePageUrl(candidate);
    } catch {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const page = await tryFetch(candidate);
    if (!page) {
      pages.push({ url: candidate, isHome: false, status: null, error: "unreachable", elapsedMs: 0, bytes: 0, xRobotsTag: null, signals: null });
      continue;
    }
    if (!isHtml(page)) continue;
    pages.push({
      url: page.finalUrl,
      isHome: false,
      status: page.status,
      error: null,
      elapsedMs: page.elapsedMs,
      bytes: page.bytes,
      xRobotsTag: page.headers["x-robots-tag"] ?? null,
      signals: page.status < 400 ? extractSignals(page.body, page.finalUrl) : null,
    });
  }

  const site: SiteFacts = {
    httpsReachable,
    httpRedirectsToHttps,
    robotsFound,
    robotsBlocksAll: robots.blocksAll,
    sitemapFound,
  };
  const issues = evaluateSite(site, pages);
  return {
    host,
    site,
    pages,
    issues,
    score: scoreIssues(issues),
    summary: { ...summarize(issues), pagesScanned: pages.length },
  };
}
