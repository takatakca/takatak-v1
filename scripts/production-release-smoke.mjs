import { PRODUCTION_ORIGIN } from "./production-release-policy.mjs";

export async function verifyProductionRelease(releaseSha, fetcher = fetch) {
  async function get(path, headers = {}) {
    const response = await fetcher(`${PRODUCTION_ORIGIN}${path}`, {
      method: "GET", headers: { Accept: "application/json", ...headers }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(`Non-JSON response on ${path}`);
    return { response, body: await response.json() };
  }
  const health = await get("/api/health");
  if (health.response.status !== 200 || health.body.status !== "ok" || health.response.headers.get("x-takatak-release") !== releaseSha) throw new Error("Production is not serving the exact accepted release");
  const ready = await get("/api/health/ready");
  if (ready.response.status !== 200 || ready.body.ok !== true || ready.body.checks?.database !== "ok" || ready.body.checks?.supabase !== "ok") throw new Error("Production database/auth readiness is not accepted");
  const path = "/api/integrations/ahmv/content/overlays";
  const noTenant = await get(path);
  const noToken = await get(path, { "X-AHMV-Tenant": "ahmverdun" });
  if (![403, 503].includes(noTenant.response.status) || ![401, 503].includes(noToken.response.status) || noTenant.body.ok !== false || noToken.body.ok !== false) throw new Error("AHMV GET overlay route does not enforce its server auth boundary");
  return { release: releaseSha, content: noToken.response.status === 503 ? "not_configured" : "auth_boundary_ready" };
}

if (process.argv[1]?.endsWith("production-release-smoke.mjs")) {
  try {
    const result = await verifyProductionRelease(process.env.RELEASE_SHA);
    console.log(`Production release accepted: ${result.release}; content bridge ${result.content}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production smoke failed");
    process.exit(1);
  }
}
