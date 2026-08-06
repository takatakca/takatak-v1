export const SOCIAL_CONNECTION_PROVIDERS = [
  "meta",
  "google",
  "linkedin",
  "tiktok",
  "pinterest",
  "x",
  "bluesky",
  "twitch",
] as const;

export type SocialConnectionProviderValue =
  (typeof SOCIAL_CONNECTION_PROVIDERS)[number];

export type ProviderEnvironmentName =
  | "META_APP_ID"
  | "META_APP_SECRET"
  | "GOOGLE_SOCIAL_CLIENT_ID"
  | "GOOGLE_SOCIAL_CLIENT_SECRET"
  | "LINKEDIN_CLIENT_ID"
  | "LINKEDIN_CLIENT_SECRET"
  | "TIKTOK_CLIENT_KEY"
  | "TIKTOK_CLIENT_SECRET"
  | "PINTEREST_APP_ID"
  | "PINTEREST_APP_SECRET"
  | "X_CLIENT_ID"
  | "X_CLIENT_SECRET"
  | "BLUESKY_APP_PASSWORD"
  | "TWITCH_CLIENT_ID"
  | "TWITCH_CLIENT_SECRET";

export type SocialProviderDefinition = {
  provider: SocialConnectionProviderValue;
  label: string;
  description: string;
  platforms: string[];
  authorizationType:
    | "oauth2"
    | "oauth2_pkce"
    | "app_password";
  requiredEnvironment: ProviderEnvironmentName[];
  implemented: boolean;
  connectable: boolean;
};

export type SocialProviderReadiness = {
  provider: SocialConnectionProviderValue;
  label: string;
  implemented: boolean;
  connectable: boolean;
  configured: boolean;
  missingEnvironment: ProviderEnvironmentName[];
  state:
    | "planned"
    | "not_configured"
    | "ready_for_authorization";
};
