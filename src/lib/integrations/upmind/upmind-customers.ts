import "server-only";

import { randomBytes } from "node:crypto";

import {
  getUpmindApiBaseUrl,
  getUpmindApiKey,
  getUpmindBrandId,
} from "./env";

/**
 * Upmind billing-customer helpers.
 *
 * Endpoints come from the former TAKATAK backend that already talked to
 * https://api.upmind.io/api (GET/POST /admin/clients). See
 * https://apidocs.upmind.com/
 */

const TIMEOUT_MS = 15000;

export type UpmindCustomerLookup = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

function redact(text: string): string {
  const key = getUpmindApiKey();
  return key ? text.split(key).join("[REDACTED_KEY]") : text;
}

function extractId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    id?: unknown;
    data?: { id?: unknown } | Array<{ id?: unknown; email?: unknown }>;
  };

  if (typeof record.id === "string" && record.id.length > 0) {
    return record.id;
  }

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    const nestedId = record.data.id;
    if (typeof nestedId === "string" && nestedId.length > 0) {
      return nestedId;
    }
  }

  if (Array.isArray(record.data)) {
    const match = record.data.find((row) => typeof row?.id === "string");
    if (match && typeof match.id === "string") {
      return match.id;
    }
  }

  return null;
}

async function upmindRequest(
  method: "GET" | "POST",
  path: string,
  options?: { query?: Record<string, string>; body?: Record<string, unknown> },
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
      body: options?.body ? JSON.stringify(options.body) : undefined,
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

  if (exact && typeof exact.id === "string") {
    return exact.id;
  }

  const first = rows.find((row) => typeof row.id === "string");
  return first && typeof first.id === "string" ? first.id : null;
}

async function createClient(lookup: UpmindCustomerLookup): Promise<string | null> {
  const brandId = getUpmindBrandId();
  if (!brandId) {
    console.error("[upmind-customers] NEXT_PUBLIC_UPMIND_BRAND_ID is missing.");
    return null;
  }

  const result = await upmindRequest("POST", "/admin/clients", {
    body: {
      brand_id: brandId,
      email: lookup.email,
      firstname:
        lookup.firstName?.trim() ||
        lookup.email.split("@")[0] ||
        "TAKATAK",
      lastname:
        lookup.lastName?.trim() ||
        lookup.firstName?.trim() ||
        lookup.email.split("@")[0] ||
        "Customer",
      phone: lookup.phone ?? "",
      login_enabled: true,
      // Upmind requires a password on create. TAKATAK remains the login.
      // This value is never stored, logged, or shown to the user.
      password: randomBytes(24).toString("base64url"),
    },
  });

  if (!result.ok) {
    console.error(
      "[upmind-customers] Client create failed:",
      result.status,
      redact(JSON.stringify(result.payload ?? "")).slice(0, 200),
    );
    return null;
  }

  return extractId(result.payload);
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
 * Find the Upmind customer for this TAKATAK person, or create one.
 * Does not log tokens, passwords, or raw provider payloads beyond a redacted error.
 */
export async function findOrCreateUpmindCustomer(
  lookup: UpmindCustomerLookup,
): Promise<{ clientId: string | null; created: boolean }> {
  if (!getUpmindApiKey() || !getUpmindApiBaseUrl()) {
    return { clientId: null, created: false };
  }

  try {
    const existingId = await findClientIdByEmail(lookup.email);
    if (existingId) {
      return { clientId: existingId, created: false };
    }

    const createdId = await createClient(lookup);
    return { clientId: createdId, created: Boolean(createdId) };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "unknown error";
    console.error(
      "[upmind-customers] Lookup failed:",
      redact(raw).slice(0, 200),
    );
    return { clientId: null, created: false };
  }
}
