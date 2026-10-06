import "server-only";

// Google PageSpeed Insights v5 (official API). Requires PAGESPEED_API_KEY: the
// keyless shared quota is routinely exhausted, so we never rely on it.

import { parsePageSpeed, type PageSpeedReport } from "./pagespeed-parse";
import { normalizeAuditUrl } from "./site-audit";

export function pageSpeedConfigured(): boolean {
  return Boolean(process.env.PAGESPEED_API_KEY?.trim());
}

export type PageSpeedResult = { ok: true; report: PageSpeedReport } | { ok: false; error: string };

export async function runPageSpeed(rawUrl: string, strategy: "mobile" | "desktop"): Promise<PageSpeedResult> {
  if (!pageSpeedConfigured()) return { ok: false, error: "Performance tests need a Google PageSpeed API key (PAGESPEED_API_KEY)." };
  let url: URL;
  try {
    url = normalizeAuditUrl(rawUrl);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid address." };
  }
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url.toString());
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("key", process.env.PAGESPEED_API_KEY!.trim());
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(90_000), cache: "no-store" });
    if (response.status === 429) return { ok: false, error: "Google's PageSpeed quota is used up for now. Try again later." };
    if (!response.ok) return { ok: false, error: `Google could not test this page (HTTP ${response.status}).` };
    const report = parsePageSpeed(await response.json(), strategy, url.toString());
    return report ? { ok: true, report } : { ok: false, error: "Google returned an unexpected response." };
  } catch {
    return { ok: false, error: "The performance test timed out. Try again." };
  }
}
