// Website lead capture — server configuration. Disabled unless explicitly
// enabled and pointed at the TAKATAK agency workspace (a Client id) that
// owns inbound website requests.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i;

export type WebsiteLeadsConfig =
  | { enabled: false }
  | {
      enabled: true;
      clientId: string;
      /** Internal TAKATAK address alerted for each new lead; null = in-app only. */
      notifyEmail: string | null;
    };

export function readWebsiteLeadsConfig(
  env: Record<string, string | undefined> = process.env,
): WebsiteLeadsConfig {
  if (env.WEBSITE_LEADS_ENABLED?.trim() !== "true") return { enabled: false };
  const clientId = env.WEBSITE_LEADS_CLIENT_ID?.trim() ?? "";
  if (!UUID_RE.test(clientId)) return { enabled: false };
  const notifyEmail = env.WEBSITE_LEADS_NOTIFY_EMAIL?.trim() ?? "";
  return {
    enabled: true,
    clientId: clientId.toLowerCase(),
    notifyEmail: EMAIL_RE.test(notifyEmail) ? notifyEmail.toLowerCase() : null,
  };
}
