/**
 * Facebook/Instagram CDN picture URLs expire and often 403 in the browser
 * when the page Referer is a third-party origin (takatak.ca).
 * Same-origin proxy URLs keep Page IDs off the client.
 */

const FACEBOOK_IMAGE_HOSTS = [
  "graph.facebook.com",
  "graph.instagram.com",
  "fbcdn.net",
  "fbsbx.com",
  "cdninstagram.com",
] as const;

export function isFacebookHostedImageUrl(
  value: string | null | undefined,
): boolean {
  const hostname = hostnameOf(value);
  if (!hostname) return false;
  return FACEBOOK_IMAGE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export function isAllowedSocialImageUrl(
  value: string | null | undefined,
): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && isFacebookHostedImageUrl(url.href);
  } catch {
    return false;
  }
}

export function toAccountPictureSrc(
  accountId: string | null | undefined,
): string | null {
  const id = typeof accountId === "string" ? accountId.trim() : "";
  if (!id) return null;
  return `/api/social/media/picture/${id}`;
}

export function toClientSocialImageUrl(
  value: string | null | undefined,
): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;
  if (!isAllowedSocialImageUrl(trimmed)) return trimmed;
  return `/api/social/media/remote?u=${encodeURIComponent(trimmed)}`;
}

function hostnameOf(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}
