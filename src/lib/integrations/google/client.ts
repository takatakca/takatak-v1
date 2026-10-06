import "server-only";

// Google Analytics Data API (GA4) + Search Console API through one service
// account. Read-only scopes. Each client grants the service account access to
// its own GA4 property / Search Console site; nothing is called otherwise.

import { buildServiceAccountAssertion } from "./jwt";
import { parseGa4DailyReport, parseSearchConsoleQueries, type Ga4Summary, type SearchQueryRow } from "./parse";

const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly", "https://www.googleapis.com/auth/webmasters.readonly"];
const TIMEOUT_MS = 20_000;

let cachedToken: { value: string; expiresAt: number } | null = null;

export function googleServiceAccountConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim());
}

export function googleServiceAccountEmail(): string | null {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || null;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.value;
  const assertion = buildServiceAccountAssertion({
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!.trim(),
    privateKeyPem: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.trim(),
    scopes: SCOPES,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`google_token_${response.status}`);
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("google_token_missing");
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

export type GoogleResult<T> = { ok: true; data: T } | { ok: false; reason: string };

async function googlePost(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

function reasonFor(status: number): string {
  if (status === 403) return "access_denied — grant the service account access to this property";
  if (status === 404) return "property_not_found";
  if (status === 429) return "quota_exceeded";
  return `http_${status}`;
}

export async function fetchGa4Daily(propertyId: string, days: number): Promise<GoogleResult<Ga4Summary>> {
  if (!googleServiceAccountConfigured()) return { ok: false, reason: "not_configured" };
  try {
    const response = await googlePost(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "yesterday" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
      limit: 400,
    });
    if (!response.ok) return { ok: false, reason: reasonFor(response.status) };
    const parsed = parseGa4DailyReport(await response.json());
    return parsed ? { ok: true, data: parsed } : { ok: false, reason: "unexpected_response" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.message.startsWith("google_token") ? "auth_failed" : "unreachable" };
  }
}

export async function fetchSearchQueries(property: string, days: number, limit = 25): Promise<GoogleResult<SearchQueryRow[]>> {
  if (!googleServiceAccountConfigured()) return { ok: false, reason: "not_configured" };
  const end = new Date(Date.now() - 3 * 86_400_000); // Search Console data lags ~2–3 days.
  const start = new Date(end.getTime() - days * 86_400_000);
  try {
    const response = await googlePost(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["query"],
      rowLimit: limit,
    });
    if (!response.ok) return { ok: false, reason: reasonFor(response.status) };
    const parsed = parseSearchConsoleQueries(await response.json());
    return parsed ? { ok: true, data: parsed } : { ok: false, reason: "unexpected_response" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.message.startsWith("google_token") ? "auth_failed" : "unreachable" };
  }
}
