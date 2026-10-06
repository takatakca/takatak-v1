// Website lead capture — server configuration. Disabled unless explicitly
// enabled and pointed at the TAKATAK agency workspace (a Client id) that
// owns inbound website requests.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WebsiteLeadsConfig =
  | { enabled: false }
  | { enabled: true; clientId: string };

export function readWebsiteLeadsConfig(
  env: Record<string, string | undefined> = process.env,
): WebsiteLeadsConfig {
  if (env.WEBSITE_LEADS_ENABLED?.trim() !== "true") return { enabled: false };
  const clientId = env.WEBSITE_LEADS_CLIENT_ID?.trim() ?? "";
  if (!UUID_RE.test(clientId)) return { enabled: false };
  return { enabled: true, clientId: clientId.toLowerCase() };
}
