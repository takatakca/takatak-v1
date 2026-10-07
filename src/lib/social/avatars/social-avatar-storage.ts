import "server-only";

const AVATAR_BUCKET = "social-avatars";
const MAX_AVATAR_BYTES = 1_500_000;

export type StoredSocialAvatar = {
  bytes: Uint8Array;
  contentType: string;
  byteSize: number;
  etag: string | null;
};

function storageConfig(): {
  baseUrl: string;
  secretKey: string;
} | null {
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";

  if (!baseUrl || !secretKey) return null;

  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }

  return { baseUrl, secretKey };
}

function encodedStoragePath(storageKey: string): string {
  return storageKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function objectUrl(
  baseUrl: string,
  storageKey: string,
): string {
  return (
    `${baseUrl}/storage/v1/object/` +
    `${encodeURIComponent(AVATAR_BUCKET)}/` +
    encodedStoragePath(storageKey)
  );
}

function authorizedHeaders(
  secretKey: string,
): Record<string, string> {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

function extensionForContentType(
  contentType: string,
): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

export function buildSocialAvatarStorageKey(options: {
  clientId: string;
  platform: string;
  accountId: string;
  contentType: string;
}): string {
  const platform = options.platform
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");

  const extension = extensionForContentType(options.contentType);

  return [
    options.clientId,
    platform,
    options.accountId,
    `profile.${extension}`,
  ].join("/");
}

export async function readStoredSocialAvatar(
  storageKey: string,
): Promise<StoredSocialAvatar | null> {
  const config = storageConfig();
  if (!config || !storageKey.trim()) return null;

  const response = await fetch(
    objectUrl(config.baseUrl, storageKey),
    {
      method: "GET",
      redirect: "error",
      headers: authorizedHeaders(config.secretKey),
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Stored social avatar could not be read.");
  }

  const contentType = (
    response.headers.get("content-type") ?? ""
  )
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error("Stored social avatar has an invalid content type.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_AVATAR_BYTES
  ) {
    throw new Error("Stored social avatar has an invalid size.");
  }

  return {
    bytes,
    contentType,
    byteSize: bytes.byteLength,
    etag: response.headers.get("etag"),
  };
}

export async function writeStoredSocialAvatar(options: {
  storageKey: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<void> {
  const config = storageConfig();

  if (!config) {
    throw new Error("Social avatar storage is not configured.");
  }

  if (
    options.bytes.byteLength === 0 ||
    options.bytes.byteLength > MAX_AVATAR_BYTES
  ) {
    throw new Error("Social avatar size is invalid.");
  }

  if (!options.contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Social avatar content type is invalid.");
  }

  const response = await fetch(
    objectUrl(config.baseUrl, options.storageKey),
    {
      method: "POST",
      redirect: "error",
      headers: {
        ...authorizedHeaders(config.secretKey),
        "Content-Type": options.contentType,
        "Cache-Control": "3600",
        "x-upsert": "true",
      },
      body: options.bytes as unknown as BodyInit,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Social avatar storage upload failed with status ${response.status}.`,
    );
  }
}

export function isSocialAvatarStorageConfigured(): boolean {
  return storageConfig() !== null;
}
