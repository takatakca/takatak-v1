// SEO audit rules and scoring. Pure: takes collected facts, returns issues.

import type { PageSignals } from "./html";

export type Severity = "critical" | "warning" | "notice";

export type AuditIssue = {
  checkKey: string;
  severity: Severity;
  pageUrl: string | null;
  detail: string;
};

export type PageFacts = {
  url: string;
  isHome: boolean;
  status: number | null;
  error: string | null;
  elapsedMs: number;
  bytes: number;
  xRobotsTag: string | null;
  signals: PageSignals | null;
};

export type SiteFacts = {
  httpsReachable: boolean;
  httpRedirectsToHttps: boolean | null;
  robotsFound: boolean;
  robotsBlocksAll: boolean;
  sitemapFound: boolean;
};

/** Plain-language labels for the dashboard (EN). */
export const CHECK_LABELS: Record<string, string> = {
  https_unavailable: "Website is not reachable over HTTPS",
  http_not_redirected: "HTTP does not redirect to HTTPS",
  robots_blocks_all: "robots.txt blocks search engines from the whole site",
  robots_missing: "No robots.txt file",
  sitemap_missing: "No XML sitemap found",
  page_error: "Page returns an error",
  noindex: "Page is hidden from search engines (noindex)",
  title_missing: "Missing page title",
  title_length: "Page title length is not ideal",
  title_duplicate: "Same title used on several pages",
  meta_description_missing: "Missing meta description",
  meta_description_length: "Meta description length is not ideal",
  h1_missing: "Missing main heading (H1)",
  h1_multiple: "Several H1 headings on one page",
  canonical_missing: "No canonical URL",
  viewport_missing: "Not mobile-ready (no viewport tag)",
  lang_missing: "Page language is not declared",
  images_missing_alt: "Images without alt text",
  social_tags_missing: "Missing social sharing tags (Open Graph)",
  structured_data_missing: "No structured data (schema.org) on homepage",
  slow_response: "Slow server response",
  heavy_page: "Heavy page",
};

const WEIGHT: Record<Severity, number> = { critical: 12, warning: 5, notice: 1 };

export function evaluateSite(site: SiteFacts, pages: PageFacts[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (checkKey: string, severity: Severity, pageUrl: string | null, detail: string) =>
    issues.push({ checkKey, severity, pageUrl, detail });

  if (!site.httpsReachable) add("https_unavailable", "critical", null, "The site did not answer correctly on https://.");
  if (site.httpRedirectsToHttps === false) add("http_not_redirected", "warning", null, "Visitors using http:// are not sent to the secure version.");
  if (site.robotsBlocksAll) add("robots_blocks_all", "critical", null, "robots.txt contains \"Disallow: /\" for all crawlers.");
  else if (!site.robotsFound) add("robots_missing", "notice", null, "Add a robots.txt that points to your sitemap.");
  if (!site.sitemapFound) add("sitemap_missing", "warning", null, "Publish /sitemap.xml so search engines find every page.");

  const titles = new Map<string, string[]>();

  for (const page of pages) {
    if (page.error || page.status === null || page.status >= 400) {
      add("page_error", "critical", page.url, page.error ? `Could not load (${page.error}).` : `HTTP ${page.status}.`);
      continue;
    }
    const s = page.signals;
    if (!s) continue;

    const robots = `${s.metaRobots ?? ""} ${page.xRobotsTag ?? ""}`.toLowerCase();
    if (/\bnoindex\b/.test(robots)) add("noindex", "critical", page.url, "Search engines are told not to index this page.");

    if (!s.title) add("title_missing", "critical", page.url, "Add a unique, descriptive <title>.");
    else {
      if (s.title.length < 15 || s.title.length > 65) {
        add("title_length", "warning", page.url, `${s.title.length} characters (aim for 15–65).`);
      }
      const key = s.title.toLowerCase();
      titles.set(key, [...(titles.get(key) ?? []), page.url]);
    }

    if (!s.metaDescription) add("meta_description_missing", "warning", page.url, "Add a 50–160 character summary for search results.");
    else if (s.metaDescription.length < 50 || s.metaDescription.length > 170) {
      add("meta_description_length", "notice", page.url, `${s.metaDescription.length} characters (aim for 50–160).`);
    }

    if (s.h1Count === 0) add("h1_missing", "warning", page.url, "Add one H1 that states what the page is about.");
    else if (s.h1Count > 1) add("h1_multiple", "notice", page.url, `${s.h1Count} H1 headings found.`);

    if (!s.canonical) add("canonical_missing", "notice", page.url, "Declare the preferred URL with <link rel=\"canonical\">.");
    if (!s.viewport) add("viewport_missing", "critical", page.url, "Add <meta name=\"viewport\"> so the page works on phones.");
    if (!s.lang) add("lang_missing", "notice", page.url, "Add lang=\"fr\" or lang=\"en\" on the <html> tag.");
    if (s.imagesMissingAlt > 0) {
      add("images_missing_alt", "warning", page.url, `${s.imagesMissingAlt} of ${s.imagesTotal} images have no alt text.`);
    }
    if (!s.ogTitle || !s.ogImage) {
      add("social_tags_missing", "notice", page.url, `Missing ${[!s.ogTitle && "og:title", !s.ogImage && "og:image"].filter(Boolean).join(" and ")}.`);
    }
    if (page.isHome && !s.structuredData) {
      add("structured_data_missing", "notice", page.url, "Add LocalBusiness / Organization JSON-LD.");
    }

    if (page.elapsedMs > 2500) add("slow_response", "warning", page.url, `${page.elapsedMs} ms to load the HTML.`);
    else if (page.elapsedMs > 1200) add("slow_response", "notice", page.url, `${page.elapsedMs} ms to load the HTML.`);

    if (page.bytes > 1_000_000) add("heavy_page", "warning", page.url, `${Math.round(page.bytes / 1024)} KB of HTML.`);
    else if (page.bytes > 500_000) add("heavy_page", "notice", page.url, `${Math.round(page.bytes / 1024)} KB of HTML.`);
  }

  for (const urls of titles.values()) {
    if (urls.length > 1) {
      for (const url of urls) add("title_duplicate", "warning", url, `Shared by ${urls.length} pages.`);
    }
  }

  return issues;
}

/**
 * 100 minus, for each failed check, its weight once plus 1 per additional
 * affected page (max +4), so one site-wide template bug does not zero the
 * score but repeated problems still count.
 */
export function scoreIssues(issues: AuditIssue[]): number {
  const byKey = new Map<string, { severity: Severity; count: number }>();
  for (const issue of issues) {
    const current = byKey.get(issue.checkKey);
    if (!current) byKey.set(issue.checkKey, { severity: issue.severity, count: 1 });
    else {
      current.count += 1;
      if (WEIGHT[issue.severity] > WEIGHT[current.severity]) current.severity = issue.severity;
    }
  }
  let penalty = 0;
  for (const { severity, count } of byKey.values()) {
    penalty += WEIGHT[severity] + Math.min(count - 1, 4);
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function summarize(issues: AuditIssue[]) {
  return {
    critical: issues.filter((i) => i.severity === "critical").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    notice: issues.filter((i) => i.severity === "notice").length,
  };
}
