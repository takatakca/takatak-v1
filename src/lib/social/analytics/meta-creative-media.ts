/**
 * Creative metadata from authorized Meta Ads `/ads` response only.
 * Do not proxy arbitrary external media or persist signed preview URLs.
 */
const META_IMAGE_HOSTS = [
  "facebook.com",
  "fbcdn.net",
  "fbsbx.com",
  "cdninstagram.com",
  "instagram.com",
] as const;

export function safeMetaCreativeThumbnail(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash || url.searchParams.has("access_token") ||
      /(?:access[_-]?token|authorization|password|secret)/i.test(url.search)) {
    return null;
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!META_IMAGE_HOSTS.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) return null;
  return url.href;
}

export function safeCreativeCopy(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  return normalized ? normalized.slice(0, Math.max(0, Math.min(maxLength, 500))) : null;
}

export function safeCreativeAction(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z][A-Z_]{0,49}$/.test(value)
    ? value
    : null;
}
