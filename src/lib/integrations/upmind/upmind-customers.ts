import "server-only";

import {
  getUpmindApiBaseUrl,
  getUpmindApiKey,
} from "./env";

/**
 * Upmind billing-customer helpers.
 *
 * Endpoints come from the former TAKATAK backend that already talked to
 * https://api.upmind.io/api (GET/POST /admin/clients). See
 * https://apidocs.upmind.com/
 */

const TIMEOUT_MS = 15000;

function redact(text: string): string {
  const key = getUpmindApiKey();
  return key ? text.split(key).join("[REDACTED_KEY]") : text;
}

async function upmindRequest(
  method: "GET",
  path: string,
  options?: { query?: Record<string, string> },
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const base = getUpmindApiBaseUrl();
  const key = getUpmindApiKey();
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);

  if (options?.query) {
    for (const [name, value] of Object.entries(options.query)) {
      url.searchParams.set(name, value);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function findClientIdByEmail(email: string): Promise<string | null> {
  const result = await upmindRequest("GET", "/admin/clients", {
    query: { search: email },
  });

  if (!result.ok) {
    console.error(
      "[upmind-customers] Client search failed:",
      result.status,
    );
    return null;
  }

  const payload = result.payload as {
    data?: Array<{ id?: unknown; email?: unknown }>;
  };

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const normalized = email.trim().toLowerCase();
  const exact = rows.find((row) => {
    const rowEmail =
      typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
    return rowEmail === normalized && typeof row.id === "string";
  });

  // Only an exact email match: linking "the first search result" could attach
  // another person's billing record to this account.
  return exact && typeof exact.id === "string" ? exact.id : null;
}

/**
 * Former TAKATAK backend: GET /admin/clients/{id}/orders
 */
export async function listUpmindClientOrders(
  clientId: string,
): Promise<unknown[]> {
  if (!getUpmindApiKey() || !getUpmindApiBaseUrl() || !clientId) {
    return [];
  }

  const result = await upmindRequest(
    "GET",
    `/admin/clients/${encodeURIComponent(clientId)}/orders`,
  );

  if (!result.ok) {
    console.error(
      "[upmind-customers] Order list failed:",
      result.status,
    );
    return [];
  }

  const payload = result.payload as { data?: unknown };
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(result.payload)) {
    return result.payload;
  }
  return [];
}

/**
 * Find the billing customer this TAKATAK person already registered.
 * TAKATAK never creates one (owner and client rule, 2026-11-28): the customer
 * registers in billing personally, chooses the password and accepts the terms.
 * Does not log tokens or raw provider payloads beyond a redacted error.
 */
export async function findUpmindCustomerId(email: string): Promise<string | null> {
  if (!getUpmindApiKey() || !getUpmindApiBaseUrl()) {
    return null;
  }

  try {
    return await findClientIdByEmail(email);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "unknown error";
    console.error(
      "[upmind-customers] Lookup failed:",
      redact(raw).slice(0, 200),
    );
    return null;
  }
}
