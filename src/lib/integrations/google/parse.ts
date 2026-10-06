// Pure parsers for GA4 Data API runReport and Search Console searchAnalytics.query.

export interface Ga4DailyRow {
  date: string; // YYYY-MM-DD
  sessions: number;
  users: number;
  pageViews: number;
}

export interface Ga4Summary {
  totals: { sessions: number; users: number; pageViews: number };
  daily: Ga4DailyRow[];
}

type Ga4Response = {
  rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
};

/** Expects dimensions [date] and metrics [sessions, activeUsers, screenPageViews] in that order. */
export function parseGa4DailyReport(raw: unknown): Ga4Summary | null {
  if (!raw || typeof raw !== "object") return null;
  const rows = (raw as Ga4Response).rows ?? [];
  const daily: Ga4DailyRow[] = [];
  for (const row of rows) {
    const d = row.dimensionValues?.[0]?.value ?? "";
    if (!/^\d{8}$/.test(d)) continue;
    const n = (i: number) => Number(row.metricValues?.[i]?.value ?? 0) || 0;
    daily.push({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, sessions: n(0), users: n(1), pageViews: n(2) });
  }
  daily.sort((a, b) => a.date.localeCompare(b.date));
  return {
    totals: {
      sessions: daily.reduce((s, r) => s + r.sessions, 0),
      users: daily.reduce((s, r) => s + r.users, 0),
      pageViews: daily.reduce((s, r) => s + r.pageViews, 0),
    },
    daily,
  };
}

export interface SearchQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1
  position: number;
}

type ScResponse = { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };

export function parseSearchConsoleQueries(raw: unknown): SearchQueryRow[] | null {
  if (!raw || typeof raw !== "object") return null;
  return ((raw as ScResponse).rows ?? [])
    .filter((r) => typeof r.keys?.[0] === "string")
    .map((r) => ({
      query: String(r.keys![0]).slice(0, 200),
      clicks: Number(r.clicks ?? 0),
      impressions: Number(r.impressions ?? 0),
      ctr: Number(r.ctr ?? 0),
      position: Math.round(Number(r.position ?? 0) * 10) / 10,
    }));
}

export function isValidGa4PropertyId(value: string): boolean {
  return /^[0-9]{6,15}$/.test(value);
}

export function normalizeSearchConsoleProperty(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^sc-domain:[a-z0-9.-]+$/i.test(v)) return v.toLowerCase();
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return `https://${url.host.toLowerCase()}${url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`}`;
  } catch {
    return null;
  }
}

// ------------------------------------------------- ownership binding (pure)
// The service account is shared by every workspace, so an identifier alone is
// never proof of ownership. A Google source may only be linked to a website
// whose domain the workspace has verified, and must belong to that domain.

/** `host` is the site's bare domain or its www. alias (no other subdomains). */
export function hostMatchesSiteDomain(host: string, domain: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  return Boolean(d) && (h === d || h === `www.${d}`);
}

/** sc-domain:<domain> exactly, or a URL-prefix property on the domain or www. */
export function searchConsolePropertyMatchesDomain(property: string, domain: string): boolean {
  const normalized = normalizeSearchConsoleProperty(property);
  if (!normalized) return false;
  if (normalized.startsWith("sc-domain:")) return normalized.slice("sc-domain:".length) === domain.trim().toLowerCase();
  try {
    const url = new URL(normalized);
    return !url.port && hostMatchesSiteDomain(url.hostname, domain);
  } catch {
    return false;
  }
}

interface Ga4StreamsResponse {
  dataStreams?: Array<{ type?: string; webStreamData?: { defaultUri?: string } }>;
}

/** Hosts of a GA4 property's web data streams (Admin API dataStreams.list). */
export function parseGa4WebStreamHosts(raw: unknown): string[] | null {
  if (!raw || typeof raw !== "object") return null;
  const hosts: string[] = [];
  for (const stream of (raw as Ga4StreamsResponse).dataStreams ?? []) {
    const uri = stream.webStreamData?.defaultUri;
    if (typeof uri !== "string" || !uri) continue;
    try {
      hosts.push(new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(uri) ? uri : `https://${uri}`).hostname.toLowerCase());
    } catch {
      // Ignore malformed stream URIs.
    }
  }
  return hosts;
}
