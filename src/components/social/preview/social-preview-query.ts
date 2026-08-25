/**
 * Preserve social preview-helper query across in-app navigation.
 * Preview is UI-only and never grants backend authorization.
 */

export const SOCIAL_PREVIEW_VALUES = [
  "new",
  "subscribed",
  "onboarding",
] as const;

export type SocialPreviewValue =
  (typeof SOCIAL_PREVIEW_VALUES)[number];

export function readSocialPreview(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): SocialPreviewValue | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const value = searchParams.get("preview");
  if (
    value === "new" ||
    value === "subscribed" ||
    value === "onboarding"
  ) {
    return value;
  }

  return null;
}

/**
 * Append the current preview mode onto an internal dashboard href
 * so Manage connections / Connect flows do not snap back to Real.
 */
export function withSocialPreview(
  href: string,
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): string {
  const preview = readSocialPreview(searchParams);
  if (!preview) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const withoutHash =
    hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";

  const qIndex = withoutHash.indexOf("?");
  const path =
    qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
  const query =
    qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "";

  const params = new URLSearchParams(query);
  params.delete("accountId");
  params.set("preview", preview);

  const nextQuery = params.toString();
  return `${path}${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}
