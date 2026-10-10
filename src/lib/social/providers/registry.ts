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
    label: "Facebook",
    description:
      "Facebook Pages through Facebook Login.",
    platforms: ["facebook"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "META_APP_ID",
      "META_APP_SECRET",
    ],
    // Instagram and Threads authorize through their own OAuth cards.
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  instagram: {
    provider: "instagram",
    label: "Instagram",
    description:
      "Instagram professional accounts through independent Instagram Login. Facebook is not required.",
    platforms: ["instagram"],
    authorizationType: "oauth2",
    requiredEnvironment: [
      "INSTAGRAM_APP_ID",
      "INSTAGRAM_APP_SECRET",
    ],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  threads: {
    provider: "threads",
    label: "Threads",
    description:
      "Threads accounts through independent Threads authorization. Facebook and Instagram credentials are not reused.",
    platforms: ["threads"],
    authorizationType: "oauth2",
    requiredEnvironment: [
      "THREADS_APP_ID",
      "THREADS_APP_SECRET",
    ],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  google: {
    provider: "google",
    label: "YouTube",
    description:
      "YouTube channels through Google OAuth.",
    platforms: ["youtube"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "GOOGLE_SOCIAL_CLIENT_ID",
      "GOOGLE_SOCIAL_CLIENT_SECRET",
    ],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  google_business: {
    provider: "google_business",
    label: "Google Business Profile",
    description:
      "Google Business Profile locations through Google OAuth.",
    platforms: ["google_business"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "GOOGLE_SOCIAL_CLIENT_ID",
      "GOOGLE_SOCIAL_CLIENT_SECRET",
    ],
    implemented: true,
    connectable: true,
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
      "TikTok personal accounts through Login Kit. Facebook is not required.",
    platforms: ["tiktok"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "TIKTOK_CLIENT_KEY",
      "TIKTOK_CLIENT_SECRET",
    ],
    implemented: true,
    connectable: true,
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
      "X accounts through OAuth 2.0. Facebook is not required.",
    platforms: ["x"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "X_CLIENT_ID",
      "X_CLIENT_SECRET",
    ],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  bluesky: {
    provider: "bluesky",
    label: "Bluesky",
    description:
      "Bluesky account access through secure AT Protocol OAuth.",
    platforms: ["bluesky"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "BLUESKY_OAUTH_PRIVATE_JWK",
    ],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  twitch: {
    provider: "twitch",
    label: "Twitch",
    description:
      "Twitch channels through OAuth 2.0. Facebook is not required.",
    platforms: ["twitch"],
    authorizationType:
      "oauth2_pkce",
    requiredEnvironment: [
      "TWITCH_CLIENT_ID",
      "TWITCH_CLIENT_SECRET",
    ],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  web: {
    provider: "web",
    label: "Web",
    description:
      "A public website verified with a homepage tag. Facebook is not required.",
    platforms: ["web"],
    authorizationType: "site_verification",
    requiredEnvironment: [],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  blog: {
    provider: "blog",
    label: "Blog",
    description:
      "A TAKATAK blog page for a website that is already connected.",
    platforms: ["blog"],
    authorizationType: "site_verification",
    requiredEnvironment: [],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  meta_ads: {
    provider: "meta_ads",
    label: "Meta Ads",
    description:
      "Meta ad accounts through Facebook Login. Page publishing is not requested.",
    platforms: ["meta_ads"],
    authorizationType: "oauth2_pkce",
    requiredEnvironment: [
      "META_APP_ID",
      "META_APP_SECRET",
    ],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  google_ads: {
    provider: "google_ads",
    label: "Google Ads",
    description:
      "Google Ads accounts through Google OAuth. YouTube and Business Profile are not requested.",
    platforms: ["google_ads"],
    authorizationType: "oauth2_pkce",
    requiredEnvironment: [
      "GOOGLE_SOCIAL_CLIENT_ID",
      "GOOGLE_SOCIAL_CLIENT_SECRET",
    ],
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: false,
  },

  looker_studio: {
    provider: "looker_studio",
    label: "Looker Studio",
    description:
      "Looker Studio reports through Google OAuth. YouTube, Business Profile, and Google Ads are not requested.",
    platforms: ["looker_studio"],
    authorizationType: "oauth2_pkce",
    requiredEnvironment: [
      "GOOGLE_SOCIAL_CLIENT_ID",
      "GOOGLE_SOCIAL_CLIENT_SECRET",
    ],
    implemented: true,
    connectable: true,
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
