// Gate 3: TAKATAK server → MIMT overview.
//
// Reads MIMT_API_URL and MIMT_API_KEY from the server environment only.
// The key is sent in the x-mimt-api-key header. It is never placed in the
// URL, a query string, a log line, or an error message.
// voip-status.ts stays free of network calls and still returns only
// not_configured or configured_untested.

import { getVoipConnectionStatus, isHttpsUrl } from "./voip-status";

export interface MimtNumberOverview {
  phone_number_id: string;
  e164: string;
  state: string;
}

export interface MimtOverview {
  global_user_id: string;
  connected: boolean;
  telecom_account_id?: string;
  workspace_id?: string | null;
  business_id?: string | null;
  kind?: string;
  status?: string;
  plan?: string;
  features?: string[];
  e911_registered?: boolean;
  numbers: MimtNumberOverview[];
}

type EnvLike = Record<string, string | undefined>;

const E164 = /^\+[1-9]\d{6,14}$/;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function mimtOverviewUrl(apiUrl: string, globalUserId: string): URL | null {
  const base = apiUrl.trim();
  if (!isHttpsUrl(base)) return null;
  const user = globalUserId.trim();
  if (!user || user.length > 128) return null;
  let url: URL;
  try {
    url = new URL("/v1/takatak/overview", base.endsWith("/") ? base : base + "/");
  } catch {
    return null;
  }
  if (url.username || url.password || url.protocol !== "https:") return null;
  url.search = "";
  url.searchParams.set("global_user_id", user);
  return url;
}

function readNumbers(value: unknown): MimtNumberOverview[] {
  if (!Array.isArray(value)) return [];
  const out: MimtNumberOverview[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.phone_number_id !== "string" || typeof row.e164 !== "string" || typeof row.state !== "string") continue;
    if (!ID.test(row.phone_number_id) || !E164.test(row.e164)) continue;
    if (row.state.length > 32) continue;
    out.push({ phone_number_id: row.phone_number_id, e164: row.e164, state: row.state });
    if (out.length >= 20) break;
  }
  return out;
}

function readOverview(body: unknown, globalUserId: string): MimtOverview | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.global_user_id !== globalUserId || typeof row.connected !== "boolean") return null;
  return {
    global_user_id: globalUserId,
    connected: row.connected,
    telecom_account_id: typeof row.telecom_account_id === "string" ? row.telecom_account_id : undefined,
    workspace_id: typeof row.workspace_id === "string" || row.workspace_id === null ? (row.workspace_id as string | null) : undefined,
    business_id: typeof row.business_id === "string" || row.business_id === null ? (row.business_id as string | null) : undefined,
    kind: typeof row.kind === "string" ? row.kind : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    plan: typeof row.plan === "string" ? row.plan : undefined,
    features: Array.isArray(row.features) ? row.features.filter((f): f is string => typeof f === "string") : undefined,
    e911_registered: typeof row.e911_registered === "boolean" ? row.e911_registered : undefined,
    numbers: readNumbers(row.numbers),
  };
}

/**
 * Live overview for one TAKATAK user. Returns null when MIMT is not configured,
 * the user id is missing, or the check does not succeed. Never throws.
 * A null result leaves the dashboard on its empty state.
 */
export async function probeMimtOverview(input: {
  globalUserId: string;
  env?: EnvLike;
  fetchImpl?: typeof fetch;
}): Promise<MimtOverview | null> {
  const env = input.env ?? process.env;
  if (getVoipConnectionStatus(env).state !== "configured_untested") return null;
  const user = input.globalUserId.trim();
  const apiUrl = env.MIMT_API_URL ?? "";
  const key = env.MIMT_API_KEY?.trim() ?? "";
  const url = mimtOverviewUrl(apiUrl, user);
  if (!url || !key) return null;
  if (url.href.includes(key)) return null;

  const fetchImpl = input.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-mimt-api-key": key,
      },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    return readOverview(await res.json(), user);
  } catch {
    return null;
  }
}
