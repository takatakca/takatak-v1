// Live chat provider configuration. Reads public (VITE_*) env only —
// never secrets. When no provider is configured, the app falls back to the
// built-in TAKATAK support panel.

export type ChatProvider = "takatak" | "tidio" | "crisp" | "intercom" | "hubspot";

function env(key: string): string | undefined {
  const v = process.env[key.replace(/^VITE_/, "NEXT_PUBLIC_")];
  return v && v.trim() ? v.trim() : undefined;
}

export interface LiveChatConfig {
  provider: ChatProvider;
  tidioKey?: string;
  crispWebsiteId?: string;
  intercomAppId?: string;
  hubspotPortalId?: string;
  /** True when an external widget is configured and should replace the bubble. */
  external: boolean;
}

export function getLiveChatConfig(): LiveChatConfig {
  const tidioKey = env("VITE_TIDIO_PUBLIC_KEY");
  const crispWebsiteId = env("VITE_CRISP_WEBSITE_ID");
  const intercomAppId = env("VITE_INTERCOM_APP_ID");
  const hubspotPortalId = env("VITE_HUBSPOT_PORTAL_ID");

  const requested = (env("VITE_LIVE_CHAT_PROVIDER") ?? "").toLowerCase() as ChatProvider;

  const available: ChatProvider[] = [];
  if (tidioKey) available.push("tidio");
  if (crispWebsiteId) available.push("crisp");
  if (intercomAppId) available.push("intercom");
  if (hubspotPortalId) available.push("hubspot");

  let provider: ChatProvider = "takatak";
  if (requested && requested !== "takatak" && available.includes(requested)) provider = requested;
  else if (!requested && available.length === 1) provider = available[0]!;

  return {
    provider,
    tidioKey,
    crispWebsiteId,
    intercomAppId,
    hubspotPortalId,
    external: provider !== "takatak",
  };
}

export const SUPPORT_EMAIL = "support@takatak.ca";