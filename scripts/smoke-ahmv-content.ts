#!/usr/bin/env tsx
/**
 * Read-only production smoke for the AHMV community-content bridge.
 *
 * Required:
 * - TAKATAK_AHMV_CONTENT_TOKEN: the server-only shared token
 *
 * Optional:
 * - SMOKE_BASE_URL: defaults to https://takatak.ca
 *
 * This script never creates or modifies a contribution/publication.
 */

export {};
const base = (process.env.SMOKE_BASE_URL ?? "https://takatak.ca").replace(/\/$/, "");
const token = (process.env.TAKATAK_AHMV_CONTENT_TOKEN ?? "").trim();

if (token.length < 32) {
  console.error("[smoke-ahmv-content] TAKATAK_AHMV_CONTENT_TOKEN must be configured (32+ chars).");
  process.exit(2);
}

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

async function get(path: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...headers,
    },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const cacheControl = response.headers.get("cache-control") ?? "";
  const robots = response.headers.get("x-robots-tag") ?? "";
  const text = await response.text();

  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    status: response.status,
    contentType,
    cacheControl,
    robots,
    text,
    json,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function main() {
  console.log(`[smoke-ahmv-content] ${base}`);
  console.log("[smoke-ahmv-content] read-only checks; no contribution is created");

  const health = await get("/api/health");
  assert("health is 200", health.status === 200, `status=${health.status}`);
  assert("health is JSON", health.contentType.includes("application/json"));

  const ready = await get("/api/health/ready");
  assert("ready is 200", ready.status === 200, `status=${ready.status}`);
  assert("ready is JSON", ready.contentType.includes("application/json"));

  const missingTenant = await get("/api/integrations/ahmv/content/overlays", {
    Authorization: `Bearer ${token}`,
  });
  assert(
    "missing tenant is rejected with 403",
    missingTenant.status === 403,
    `status=${missingTenant.status}`,
  );

  const missingAuthorization = await get("/api/integrations/ahmv/content/overlays", {
    "X-AHMV-Tenant": "ahmverdun",
  });
  assert(
    "missing authorization is rejected with 401",
    missingAuthorization.status === 401,
    `status=${missingAuthorization.status}`,
  );

  const wrongAuthorization = await get("/api/integrations/ahmv/content/overlays", {
    "X-AHMV-Tenant": "ahmverdun",
    Authorization: "Bearer definitely-not-the-production-token-000000000000",
  });
  assert(
    "wrong authorization is rejected with 401",
    wrongAuthorization.status === 401,
    `status=${wrongAuthorization.status}`,
  );

  const overlays = await get("/api/integrations/ahmv/content/overlays", {
    "X-AHMV-Tenant": "ahmverdun",
    Authorization: `Bearer ${token}`,
  });

  assert("authorized overlay read is 200", overlays.status === 200, `status=${overlays.status}`);
  assert("authorized overlay read is JSON", overlays.contentType.includes("application/json"));
  assert("authorized overlay read is no-store", overlays.cacheControl.toLowerCase().includes("no-store"));
  assert("authorized overlay read is noindex", overlays.robots.toLowerCase().includes("noindex"));

  const payload = overlays.json;
  assert(
    "overlay payload reports ok=true",
    isObject(payload) && payload.ok === true,
  );
  assert(
    "overlay payload contains publications array",
    isObject(payload) && Array.isArray(payload.publications),
  );

  if (failed > 0) {
    console.error(`[smoke-ahmv-content] ${failed} check(s) failed.`);
    process.exit(1);
  }

  console.log("[smoke-ahmv-content] all checks passed.");
}

void main();
