import "server-only";

import type {
  SocialConnectionProviderValue,
  SocialProviderDefinition,
  SocialProviderReadiness,
} from "@/lib/social/providers/types";

export const SOCIAL_PROVIDER_REGISTRY: Record<
  SocialConnectionProviderValue,
  SocialProviderDefinition
> = {
  meta: {
    provider: "meta",
    label: "Meta",
    description:
      "Facebook Pages, Instagram professional accounts, and Threads.",
    platforms: [
      "facebook",
      "instagram",
      "threads",
    ],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "META_APP_ID",
      "META_APP_SECRET",
    ],
    // Step 3 start-OAuth + Step 4 callback/token exchange.
    // Facebook is the primary OAuth card; Instagram/Threads are
    // represented through Meta and are not independent providers.
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  google: {
    provider: "google",
    label: "Google",
    description:
      "Google Business Profile and YouTube.",
    platforms: [
      "google_business",
      "youtube",
    ],
    authorizationType:
      "oauth2",
    requiredEnvironment: [
      "GOOGLE_SOCIAL_CLIENT_ID",
      "GOOGLE_SOCIAL_CLIENT_SECRET",
    ],
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
  },

  linkedin: {
    provider: "linkedin",
    label: "LinkedIn",
    description:
      "LinkedIn member and organization publishing.",
    platforms: ["linkedin"],
    authorizationType:
      "oauth2",
    requiredEnvironment: [
      "LINKEDIN_CLIENT_ID",
      "LINKEDIN_CLIENT_SECRET",
    ],
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
  },

  tiktok: {
    provider: "tiktok",
    label: "TikTok",
    description:
      "TikTok account authorization, publishing, and analytics.",
    platforms: ["tiktok"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "TIKTOK_CLIENT_KEY",
      "TIKTOK_CLIENT_SECRET",
    ],
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
  },

  pinterest: {
    provider: "pinterest",
    label: "Pinterest",
    description:
      "Pinterest boards, Pins, publishing, and analytics.",
    platforms: ["pinterest"],
    authorizationType:
      "oauth2",
    requiredEnvironment: [
      "PINTEREST_APP_ID",
      "PINTEREST_APP_SECRET",
    ],
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
  },

  x: {
    provider: "x",
    label: "X",
    description:
      "X account publishing and analytics.",
    platforms: ["x"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "X_CLIENT_ID",
      "X_CLIENT_SECRET",
    ],
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
  },

  bluesky: {
    provider: "bluesky",
    label: "Bluesky",
    description:
      "Bluesky publishing through an application password.",
    platforms: ["bluesky"],
    authorizationType:
      "app_password",
    requiredEnvironment: [
      "BLUESKY_APP_PASSWORD",
    ],
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
  },

  twitch: {
    provider: "twitch",
    label: "Twitch",
    description:
      "Twitch channel identity and analytics.",
    platforms: ["twitch"],
    authorizationType:
      "oauth2",
    requiredEnvironment: [
      "TWITCH_CLIENT_ID",
      "TWITCH_CLIENT_SECRET",
    ],
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
  },
};

export function isSocialConnectionProvider(
  value: unknown,
): value is SocialConnectionProviderValue {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      SOCIAL_PROVIDER_REGISTRY,
      value,
    )
  );
}

export function getSocialProviderDefinition(
  provider: SocialConnectionProviderValue,
): SocialProviderDefinition {
  return SOCIAL_PROVIDER_REGISTRY[
    provider
  ];
}

export function getSocialProviderReadiness(
  provider: SocialConnectionProviderValue,
): SocialProviderReadiness {
  const definition =
    getSocialProviderDefinition(provider);

  const missingEnvironment =
    definition.requiredEnvironment.filter(
      (name) =>
        !process.env[name]?.trim(),
    );

  if (!definition.implemented) {
    return {
      provider,
      label: definition.label,
      implemented: false,
      connectable: false,
      configured:
        missingEnvironment.length ===
        0,
      supportsMultipleAccounts: false,
      missingEnvironment,
      state: "planned",
    };
  }

  if (
    missingEnvironment.length > 0
  ) {
    return {
      provider,
      label: definition.label,
      implemented: true,
      connectable: false,
      configured: false,
      supportsMultipleAccounts:
        definition.supportsMultipleAccounts,
      missingEnvironment,
      state: "not_configured",
    };
  }

  return {
    provider,
    label: definition.label,
    implemented: true,
    connectable:
      definition.connectable,
    configured: true,
    supportsMultipleAccounts:
      definition.supportsMultipleAccounts,
    missingEnvironment: [],
    state:
      "ready_for_authorization",
  };
}

export function listSocialProviderReadiness(): SocialProviderReadiness[] {
  return Object.keys(
    SOCIAL_PROVIDER_REGISTRY,
  ).map((provider) =>
    getSocialProviderReadiness(
      provider as SocialConnectionProviderValue,
    ),
  );
}
