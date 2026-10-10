// First-party analytics — pure parsing helpers (no I/O; safe for QA scripts).

export type CollectType = "pageview" | "event" | "conversion";

export interface CollectPayload {
  key: string;
  type: CollectType;
  name: string | null;
  path: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  pageHost: string;
}

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const EVENT_NAME_PATTERN = /^[a-z0-9_.:-]{1,64}$/;

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const v = value.replace(/[\u0000-\u001f]/g, "").trim();
  return v ? v.slice(0, max) : null;
}

export function parseCollectPayload(raw: unknown): CollectPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const key = typeof r.k === "string" ? r.k : "";
  if (!KEY_PATTERN.test(key)) return null;

  const type: CollectType = r.t === "event" || r.t === "conversion" ? r.t : "pageview";
  let name: string | null = null;
  if (type !== "pageview") {
    const n = typeof r.n === "string" ? r.n.trim().toLowerCase() : "";
    if (!EVENT_NAME_PATTERN.test(n)) return null;
    name = n;
  }

  let page: URL;
  try {
    page = new URL(typeof r.u === "string" ? r.u.slice(0, 2048) : "");
  } catch {
    return null;
  }
  if (page.protocol !== "https:" && page.protocol !== "http:") return null;

  let referrerHost: string | null = null;
  if (typeof r.r === "string" && r.r) {
    try {
      const ref = new URL(r.r.slice(0, 2048));
      if (ref.host !== page.host) referrerHost = clip(ref.hostname.replace(/^www\./, ""), 120);
    } catch {
      referrerHost = null;
    }
  }

  const path = (page.pathname || "/").replace(/\/{2,}/g, "/").slice(0, 512) || "/";
  return {
    key,
    type,
    name,
    path,
    referrerHost,
    utmSource: clip(page.searchParams.get("utm_source"), 100),
    utmMedium: clip(page.searchParams.get("utm_medium"), 100),
    utmCampaign: clip(page.searchParams.get("utm_campaign"), 150),
    pageHost: page.host.toLowerCase(),
  };
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python-requests|axios|node-fetch|go-http|java\/|facebookexternalhit|whatsapp|embedly|quora link/i;

export function isBotUserAgent(ua: string | null): boolean {
  return !ua || ua.length < 12 || BOT_PATTERN.test(ua);
}

export function classifyDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

export function classifyBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

/** Exact origin allow-list built from a bare domain: https apex + www. */
export function originsForDomain(domain: string): string[] {
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  return [`https://${host}`, `https://www.${host}`];
}

export function normalizeSiteDomain(raw: string): string | null {
  const host = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^www\./, "");
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) return null;
  return host;
}

export function originAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin || allowed.length === 0) return false;
  return allowed.includes(origin.toLowerCase().replace(/\/$/, ""));
}

export function geoFromHeaders(headers: Headers): { country: string | null; region: string | null; city: string | null } {
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return clip(decodeURIComponent(v), 80);
    } catch {
      return clip(v, 80);
    }
  };
  const country = (headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? "").toUpperCase();
  return {
    country: /^[A-Z]{2}$/.test(country) && country !== "XX" && country !== "T1" ? country : null,
    region: decode(headers.get("x-vercel-ip-country-region") ?? headers.get("cf-region-code")),
    city: decode(headers.get("x-vercel-ip-city") ?? headers.get("cf-ipcity")),
  };
}

export const AUDIENCE_LIMITS = { maxPrefixes: 10, maxEvents: 10, minLookback: 1, maxLookback: 540 } as const;

export interface AudienceRuleInput {
  name: string;
  pathPrefixes: string[];
  eventNames: string[];
  lookbackDays: number;
}

export function parseAudienceRule(raw: Record<string, unknown>): { ok: true; value: AudienceRuleInput } | { ok: false; error: string } {
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (name.length < 2) return { ok: false, error: "Name the audience." };
  const list = (v: unknown) =>
    (typeof v === "string" ? v : "")
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  const pathPrefixes = list(raw.pathPrefixes).map((p) => (p.startsWith("/") ? p : `/${p}`).slice(0, 200));
  const eventNames = list(raw.eventNames).map((e) => e.toLowerCase());
  if (pathPrefixes.length > AUDIENCE_LIMITS.maxPrefixes || eventNames.length > AUDIENCE_LIMITS.maxEvents) {
    return { ok: false, error: "Use at most 10 pages and 10 events." };
  }
  if (eventNames.some((e) => !EVENT_NAME_PATTERN.test(e))) return { ok: false, error: "Event names use lowercase letters, digits and _ . : -" };
  const lookbackDays = Number(raw.lookbackDays ?? 30);
  if (!Number.isInteger(lookbackDays) || lookbackDays < AUDIENCE_LIMITS.minLookback || lookbackDays > AUDIENCE_LIMITS.maxLookback) {
    return { ok: false, error: "Lookback must be 1–540 days." };
  }
  if (pathPrefixes.length === 0 && eventNames.length === 0) {
    return { ok: false, error: "Add at least one page path or event (or use “/” for all visitors)." };
  }
  return { ok: true, value: { name, pathPrefixes, eventNames, lookbackDays } };
}
