// Facturations (GROUPE TAKATAK invoicing) — server-side configuration.
//
// Facturations is an independent application with its own database. TAKATAK
// talks to it only server-to-server through its signed /integration/v1 API.
// Every value here comes from server environment variables; nothing is ever
// read from the browser. Any invalid value fails closed.

export type FacturationsConfigState =
  | "disabled"
  | "not_configured"
  | "configured_untested";

export interface FacturationsConfig {
  origin: string;
  secret: string;
  issuer: string;
  audience: string;
  /** TAKATAK Client (workspace) id → Facturations business id. */
  clientBusinessMap: ReadonlyMap<string, string>;
}

export type FacturationsConfigResult =
  | { state: "disabled" }
  | { state: "not_configured"; problems: string[] }
  | { state: "configured_untested"; config: FacturationsConfig };

type Env = Record<string, string | undefined>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUSINESS_ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;
const MAX_MAPPED_CLIENTS = 200;

function parseOrigin(raw: string, production: boolean): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  const loopback =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "https:") return url.origin;
  if (url.protocol === "http:" && loopback && !production) return url.origin;
  return null;
}

function parseClientBusinessMap(
  raw: string,
): Map<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0 || entries.length > MAX_MAPPED_CLIENTS) {
    return null;
  }
  const map = new Map<string, string>();
  for (const [clientId, businessId] of entries) {
    if (!UUID_RE.test(clientId)) return null;
    if (typeof businessId !== "string" || !BUSINESS_ID_RE.test(businessId)) {
      return null;
    }
    map.set(clientId.toLowerCase(), businessId);
  }
  return map;
}

export function readFacturationsConfig(
  env: Env = process.env,
): FacturationsConfigResult {
  if (env.FACTURATIONS_INTEGRATION_ENABLED?.trim() !== "true") {
    return { state: "disabled" };
  }

  const production = env.NODE_ENV === "production";
  const problems: string[] = [];

  const origin = parseOrigin(env.FACTURATIONS_ORIGIN?.trim() ?? "", production);
  if (!origin) problems.push("FACTURATIONS_ORIGIN");

  const secret = env.FACTURATIONS_INTEGRATION_HMAC_SECRET ?? "";
  if (secret.length < 32) problems.push("FACTURATIONS_INTEGRATION_HMAC_SECRET");

  const issuer = env.FACTURATIONS_INTEGRATION_ISSUER?.trim() ?? "";
  if (!issuer || issuer.length > 200) {
    problems.push("FACTURATIONS_INTEGRATION_ISSUER");
  }

  const audience = env.FACTURATIONS_INTEGRATION_AUDIENCE?.trim() ?? "";
  if (!audience || audience.length > 200) {
    problems.push("FACTURATIONS_INTEGRATION_AUDIENCE");
  }

  const clientBusinessMap = parseClientBusinessMap(
    env.FACTURATIONS_CLIENT_BUSINESS_MAP?.trim() ?? "",
  );
  if (!clientBusinessMap) problems.push("FACTURATIONS_CLIENT_BUSINESS_MAP");

  if (problems.length || !origin || !clientBusinessMap) {
    return { state: "not_configured", problems };
  }

  return {
    state: "configured_untested",
    config: { origin, secret, issuer, audience, clientBusinessMap },
  };
}
