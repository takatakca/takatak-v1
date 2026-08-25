/**
 * Brand display image / label resolution for the social top-bar selector.
 * Never returns tokens, Page IDs, or provider metadata.
 */

export type BrandImageSource =
  | "uploaded"
  | "connected_social"
  | "initials";

export type BrandConnectedAccountImage = {
  platform: string;
  profileImageUrl: string | null;
  displayName?: string | null;
  /** Internal SocialAccount id — used to mint a same-origin picture URL. */
  accountId?: string | null;
  /** Prefer Facebook Page imagery when choosing a social fallback. */
  preferAsPrimary?: boolean;
};

/**
 * Explicit uploaded brand image wins. Otherwise use the selected/primary
 * connected social profile image (preferAsPrimary = persisted selected Page).
 * Never invent IDs; never use a non-primary discovered sibling.
 */
export function resolveBrandDisplayImage(options: {
  uploadedImageUrl: string | null | undefined;
  connectedAccounts: readonly BrandConnectedAccountImage[];
}): {
  displayImageUrl: string | null;
  source: BrandImageSource;
  accountId: string | null;
} {
  const uploaded = options.uploadedImageUrl?.trim() || null;

  if (uploaded) {
    return {
      displayImageUrl: uploaded,
      source: "uploaded",
      accountId: null,
    };
  }

  const candidates = options.connectedAccounts.filter((account) => {
    const hasImage =
      typeof account.profileImageUrl === "string" &&
      account.profileImageUrl.trim().length > 0;
    const hasFacebookAccount =
      account.platform === "facebook" &&
      typeof account.accountId === "string" &&
      account.accountId.trim().length > 0;
    return hasImage || hasFacebookAccount;
  });

  const preferred =
    candidates.find((account) => account.preferAsPrimary) ??
    candidates.find((account) => account.platform === "facebook") ??
    candidates[0];

  if (preferred) {
    return {
      displayImageUrl: preferred.profileImageUrl?.trim() || null,
      source: "connected_social",
      accountId: preferred.accountId?.trim() || null,
    };
  }

  return {
    displayImageUrl: null,
    source: "initials",
    accountId: null,
  };
}

/**
 * Top-bar / dropdown label (Metricool-style):
 * 1) Connected Facebook Page / primary account display name
 * 2) Any other connected account display name
 * 3) "Empty brand" when nothing is connected (never a demo workspace label)
 * 4) Workspace brand name only when connected accounts exist but lack names
 */
export function resolveBrandDisplayLabel(options: {
  brandName: string;
  connectedAccounts: readonly BrandConnectedAccountImage[];
}): string {
  const brandName = options.brandName.trim() || "Untitled brand";

  const named = options.connectedAccounts.filter(
    (account) =>
      typeof account.displayName === "string" &&
      account.displayName.trim().length > 0,
  );

  const preferred =
    named.find((account) => account.preferAsPrimary) ??
    named.find((account) => account.platform === "facebook") ??
    named[0];

  const pageName = preferred?.displayName?.trim();
  if (pageName) {
    return pageName;
  }

  if (options.connectedAccounts.length === 0) {
    return "Empty brand";
  }

  return brandName;
}

/** Unique platform keys for connected-account icon rows (stable order). */
export function listConnectedPlatformIcons(
  platforms: readonly string[],
): string[] {
  const preferredOrder = [
    "facebook",
    "instagram",
    "threads",
    "x",
    "tiktok",
    "youtube",
    "linkedin",
    "pinterest",
    "google",
    "google_business",
    "bluesky",
    "twitch",
    "meta_ads",
  ];

  const unique = [
    ...new Set(
      platforms
        .map((platform) => platform.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  return unique.sort((a, b) => {
    const ai = preferredOrder.indexOf(a);
    const bi = preferredOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export function brandInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
